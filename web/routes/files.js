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

    // Extract the URL based on file type
    let url;
    let type;
    if (file.image) {
      url = file.image.url;
      type = "image";
    } else if (file.sources && file.sources.length > 0) {
      url = file.sources[0].url;
      type = "video";
    }

    res.json({
      file: {
        id: file.id,
        url,
        type,
        alt: file.alt,
      },
    });
  } catch (error) {
    console.error("[API] Error creating file:", error);
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
