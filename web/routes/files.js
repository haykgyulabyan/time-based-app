import express from "express";
import shopify from "../shopify.js";

const router = express.Router();

// POST /api/files/staged-upload - Create staged upload URL
router.post("/staged-upload", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });
    const { filename, mimeType, fileSize } = req.body;

    if (!filename || !mimeType) {
      return res.status(400).json({ error: "filename and mimeType are required" });
    }

    // Determine resource type based on mime type
    const isVideo = mimeType.startsWith("video/");
    const resource = isVideo ? "VIDEO" : "IMAGE";

    const response = await client.query({
      data: {
        query: `
          mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
            stagedUploadsCreate(input: $input) {
              stagedTargets {
                url
                resourceUrl
                parameters {
                  name
                  value
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          input: [
            {
              filename,
              mimeType,
              fileSize: fileSize ? String(fileSize) : undefined,
              resource,
              httpMethod: "POST",
            },
          ],
        },
      },
    });

    const { stagedTargets, userErrors } = response.body.data.stagedUploadsCreate;

    if (userErrors && userErrors.length > 0) {
      console.error("[API] Staged upload errors:", userErrors);
      return res.status(400).json({ error: userErrors[0].message });
    }

    if (!stagedTargets || stagedTargets.length === 0) {
      return res.status(500).json({ error: "Failed to create staged upload" });
    }

    res.json({ stagedTarget: stagedTargets[0] });
  } catch (error) {
    console.error("[API] Error creating staged upload:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to get file status
async function getFileStatus(client, fileId) {
  const response = await client.query({
    data: {
      query: `
        query getFile($id: ID!) {
          node(id: $id) {
            ... on MediaImage {
              id
              alt
              image {
                url
                width
                height
              }
              fileStatus
            }
            ... on Video {
              id
              alt
              sources {
                url
                mimeType
              }
              preview {
                image {
                  url
                }
              }
              fileStatus
            }
          }
        }
      `,
      variables: { id: fileId },
    },
  });
  return response.body.data.node;
}

// Helper function to poll for file readiness with exponential backoff
async function pollForFileReady(client, fileId, maxAttempts = 60, initialDelayMs = 1000) {
  console.log(`[API] Starting to poll for file ${fileId}, max ${maxAttempts} attempts`);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Exponential backoff: 1s, 1.5s, 2s, 2.5s... capped at 5s
    const delayMs = Math.min(initialDelayMs + (attempt * 500), 5000);
    console.log(`[API] Poll attempt ${attempt + 1}/${maxAttempts} for file ${fileId} (delay: ${delayMs}ms)`);

    const node = await getFileStatus(client, fileId);
    console.log(`[API] Poll response for ${fileId}: status=${node?.fileStatus}`);

    if (node) {
      // Check if file is ready
      if (node.fileStatus === "READY") {
        if (node.image && node.image.url) {
          console.log(`[API] File ${fileId} is ready with URL: ${node.image.url}`);
          return { url: node.image.url, type: "image", alt: node.alt, id: node.id };
        } else if (node.sources && node.sources.length > 0) {
          console.log(`[API] Video ${fileId} is ready with URL: ${node.sources[0].url}`);
          return {
            url: node.sources[0].url,
            type: "video",
            alt: node.alt,
            id: node.id,
            preview: node.preview?.image?.url
          };
        } else {
          console.log(`[API] File ${fileId} is READY but no URL found yet, continuing poll...`);
        }
      } else if (node.fileStatus === "FAILED") {
        console.error(`[API] File ${fileId} processing failed`);
        throw new Error("File processing failed");
      } else {
        console.log(`[API] File ${fileId} status: ${node.fileStatus}, waiting...`);
      }
    } else {
      console.log(`[API] No node found for ${fileId}, waiting...`);
    }

    // Wait before next attempt
    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.error(`[API] File ${fileId} processing timed out after ${maxAttempts} attempts`);
  throw new Error("Video is still processing. It may take a few minutes for large videos. Please refresh and try selecting from Shop files.");
}

// POST /api/files/create - Create file from staged upload
router.post("/create", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });
    const { resourceUrl, filename, alt } = req.body;

    if (!resourceUrl) {
      return res.status(400).json({ error: "resourceUrl is required" });
    }

    // Determine content type from filename
    const isVideo = /\.(mp4|webm|mov)$/i.test(filename || "");

    const response = await client.query({
      data: {
        query: `
          mutation fileCreate($files: [FileCreateInput!]!) {
            fileCreate(files: $files) {
              files {
                id
                alt
                createdAt
                fileStatus
                ... on MediaImage {
                  image {
                    url
                    width
                    height
                  }
                }
                ... on Video {
                  sources {
                    url
                    mimeType
                  }
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          files: [
            {
              originalSource: resourceUrl,
              alt: alt || filename || "Banner media",
              contentType: isVideo ? "VIDEO" : "IMAGE",
            },
          ],
        },
      },
    });

    const { files, userErrors } = response.body.data.fileCreate;

    if (userErrors && userErrors.length > 0) {
      console.error("[API] File create errors:", userErrors);
      return res.status(400).json({ error: userErrors[0].message });
    }

    if (!files || files.length === 0) {
      return res.status(500).json({ error: "Failed to create file" });
    }

    const file = files[0];
    console.log("[API] File created:", JSON.stringify(file, null, 2));

    // Check if URL is immediately available
    let url;
    let type;
    if (file.image && file.image.url) {
      url = file.image.url;
      type = "image";
      console.log("[API] Image URL immediately available:", url);
    } else if (file.sources && file.sources.length > 0 && file.sources[0].url) {
      url = file.sources[0].url;
      type = "video";
      console.log("[API] Video URL immediately available:", url);
    }

    // If URL not ready, poll for it
    if (!url) {
      console.log("[API] File not ready immediately, starting poll for:", file.id);
      const readyFile = await pollForFileReady(client, file.id);
      console.log("[API] Polling complete, returning file:", JSON.stringify(readyFile, null, 2));
      res.json({ file: readyFile });
      return;
    }

    const result = {
      file: {
        id: file.id,
        url,
        type,
        alt: file.alt,
      },
    };
    console.log("[API] Returning file result:", JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    console.error("[API] Error creating file:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/files/status/:id - Check file processing status
router.get("/status/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });
    const { id } = req.params;

    // URL decode the ID (Shopify GIDs contain slashes)
    const fileId = decodeURIComponent(id);

    const node = await getFileStatus(client, fileId);

    if (!node) {
      return res.status(404).json({ error: "File not found" });
    }

    let result = {
      id: node.id,
      status: node.fileStatus,
      alt: node.alt,
    };

    if (node.fileStatus === "READY") {
      if (node.image && node.image.url) {
        result.url = node.image.url;
        result.type = "image";
      } else if (node.sources && node.sources.length > 0) {
        result.url = node.sources[0].url;
        result.type = "video";
        result.preview = node.preview?.image?.url;
      }
    }

    res.json({ file: result });
  } catch (error) {
    console.error("[API] Error checking file status:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/files - List shop files
router.get("/", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });
    const { type = "all", cursor, search } = req.query;

    // Build query filter
    let queryFilter = "";
    if (type === "image") {
      queryFilter = "media_type:IMAGE";
    } else if (type === "video") {
      queryFilter = "media_type:VIDEO";
    }

    if (search) {
      queryFilter += queryFilter ? ` AND filename:*${search}*` : `filename:*${search}*`;
    }

    const response = await client.query({
      data: {
        query: `
          query getFiles($first: Int!, $after: String, $query: String) {
            files(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
              edges {
                node {
                  id
                  alt
                  createdAt
                  ... on MediaImage {
                    image {
                      url
                      width
                      height
                    }
                    mimeType
                  }
                  ... on Video {
                    sources {
                      url
                      mimeType
                    }
                    preview {
                      image {
                        url
                      }
                    }
                  }
                }
                cursor
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `,
        variables: {
          first: 24,
          after: cursor || null,
          query: queryFilter || null,
        },
      },
    });

    const { edges, pageInfo } = response.body.data.files;

    const files = edges.map(({ node }) => {
      let url, type, preview, mimeType;

      if (node.image) {
        url = node.image.url;
        type = "image";
        preview = node.image.url;
        mimeType = node.mimeType;
      } else if (node.sources && node.sources.length > 0) {
        url = node.sources[0].url;
        type = "video";
        preview = node.preview?.image?.url;
        mimeType = node.sources[0].mimeType;
      }

      return {
        id: node.id,
        url,
        type,
        preview,
        alt: node.alt,
        mimeType,
        createdAt: node.createdAt,
      };
    }).filter(f => f.url); // Filter out any files without URLs

    res.json({
      files,
      pageInfo,
    });
  } catch (error) {
    console.error("[API] Error fetching files:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
