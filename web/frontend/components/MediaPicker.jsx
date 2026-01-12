import { useState, useCallback } from "react";
import {
  Modal,
  Tabs,
  DropZone,
  LegacyStack,
  Text,
  Button,
  Spinner,
  InlineError,
  TextField,
  Icon,
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { useAuthenticatedFetch } from "../hooks/useAuthenticatedFetch";
import { useTranslation } from "react-i18next";

export function MediaPicker({ open, onClose, onSelect, allowedTypes = ["image", "video"] }) {
  const { t } = useTranslation();
  const authenticatedFetch = useAuthenticatedFetch();
  const [selectedTab, setSelectedTab] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageInfo, setPageInfo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const acceptedTypes = [];
  if (allowedTypes.includes("image")) {
    acceptedTypes.push("image/jpeg", "image/png", "image/webp", "image/gif");
  }
  if (allowedTypes.includes("video")) {
    acceptedTypes.push("video/mp4", "video/webm");
  }

  const loadFiles = useCallback(async (cursor = null, append = false) => {
    setLoadingFiles(true);
    setFilesError(null);
    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (searchQuery) params.set("search", searchQuery);

      const response = await authenticatedFetch(`/api/files?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load files");
      }
      const data = await response.json();

      // Filter by allowed types
      const filteredFiles = data.files.filter(f => allowedTypes.includes(f.type));

      if (append) {
        setFiles(prev => [...prev, ...filteredFiles]);
      } else {
        setFiles(filteredFiles);
      }
      setPageInfo(data.pageInfo);
    } catch (err) {
      setFilesError(err.message);
    } finally {
      setLoadingFiles(false);
    }
  }, [authenticatedFetch, searchQuery, allowedTypes]);

  const handleTabChange = useCallback((index) => {
    setSelectedTab(index);
    if (index === 1 && files.length === 0) {
      loadFiles();
    }
  }, [loadFiles, files.length]);

  const handleDrop = useCallback(async (_dropFiles, acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setUploadError(null);

    try {
      // Step 1: Get staged upload URL
      const stagedResponse = await authenticatedFetch("/api/files/staged-upload", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      });

      if (!stagedResponse.ok) {
        const err = await stagedResponse.json();
        throw new Error(err.error || "Failed to create upload URL");
      }

      const { stagedTarget } = await stagedResponse.json();

      // Step 2: Upload file directly to Shopify
      const formData = new FormData();
      stagedTarget.parameters.forEach(({ name, value }) => {
        formData.append(name, value);
      });
      formData.append("file", file);

      const uploadResponse = await fetch(stagedTarget.url, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to Shopify");
      }

      // Step 3: Create file record in Shopify
      const createResponse = await authenticatedFetch("/api/files/create", {
        method: "POST",
        body: JSON.stringify({
          resourceUrl: stagedTarget.resourceUrl,
          filename: file.name,
          alt: file.name.replace(/\.[^/.]+$/, ""),
        }),
      });

      if (!createResponse.ok) {
        const err = await createResponse.json();
        throw new Error(err.error || "Failed to create file record");
      }

      const { file: createdFile } = await createResponse.json();

      // Validate that we have a URL
      if (!createdFile.url) {
        console.error("File created but URL is missing:", createdFile);
        throw new Error("File uploaded but URL not available. Please try again.");
      }

      // Select the uploaded file
      onSelect({
        url: createdFile.url,
        type: createdFile.type,
        alt: createdFile.alt,
        id: createdFile.id,
      });
      onClose();
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }, [authenticatedFetch, onSelect, onClose]);

  const handleSelectFile = useCallback(() => {
    if (selectedFile) {
      onSelect({
        url: selectedFile.url,
        type: selectedFile.type,
        alt: selectedFile.alt,
        id: selectedFile.id,
      });
      onClose();
    }
  }, [selectedFile, onSelect, onClose]);

  const handleSearch = useCallback(() => {
    loadFiles();
  }, [loadFiles]);

  const handleLoadMore = useCallback(() => {
    if (pageInfo?.hasNextPage) {
      loadFiles(pageInfo.endCursor, true);
    }
  }, [loadFiles, pageInfo]);

  const tabs = [
    { id: "upload", content: t("MediaPicker.uploadTab", "Upload new") },
    { id: "browse", content: t("MediaPicker.browseTab", "Shop files") },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("MediaPicker.title", "Select media")}
      primaryAction={
        selectedTab === 1 && selectedFile
          ? {
              content: t("MediaPicker.select", "Select"),
              onAction: handleSelectFile,
            }
          : undefined
      }
      secondaryActions={[
        {
          content: t("MediaPicker.cancel", "Cancel"),
          onAction: onClose,
        },
      ]}
      large
    >
      <Modal.Section>
        <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} fitted>
          <div style={{ paddingTop: "16px", minHeight: "400px" }}>
            {selectedTab === 0 && (
              <div>
                <DropZone
                  accept={acceptedTypes.join(",")}
                  type="file"
                  onDrop={handleDrop}
                  disabled={uploading}
                >
                  {uploading ? (
                    <div style={{ padding: "40px", textAlign: "center" }}>
                      <Spinner size="large" />
                      <div style={{ marginTop: "16px" }}>
                        <Text variant="bodyMd" as="p">
                          {t("MediaPicker.uploading", "Uploading to Shopify...")}
                        </Text>
                      </div>
                    </div>
                  ) : (
                    <DropZone.FileUpload
                      actionTitle={t("MediaPicker.dropzoneAction", "Add file")}
                      actionHint={t("MediaPicker.dropzoneHint", "or drop files to upload")}
                    />
                  )}
                </DropZone>
                {uploadError && (
                  <div style={{ marginTop: "16px" }}>
                    <InlineError message={uploadError} fieldID="upload-error" />
                  </div>
                )}
                <div style={{ marginTop: "16px" }}>
                  <Text variant="bodySm" tone="subdued" as="p">
                    {t("MediaPicker.uploadHint", "Supported formats: JPEG, PNG, WebP, GIF, MP4, WebM. Files are uploaded directly to your Shopify store.")}
                  </Text>
                </div>
              </div>
            )}

            {selectedTab === 1 && (
              <div>
                <div style={{ marginBottom: "16px" }}>
                  <LegacyStack>
                    <LegacyStack.Item fill>
                      <TextField
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder={t("MediaPicker.searchPlaceholder", "Search files...")}
                        prefix={<Icon source={SearchIcon} />}
                        autoComplete="off"
                        onBlur={handleSearch}
                        connectedRight={
                          <Button onClick={handleSearch}>
                            {t("MediaPicker.search", "Search")}
                          </Button>
                        }
                      />
                    </LegacyStack.Item>
                  </LegacyStack>
                </div>

                {loadingFiles && files.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center" }}>
                    <Spinner size="large" />
                  </div>
                ) : filesError ? (
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    <InlineError message={filesError} fieldID="files-error" />
                    <div style={{ marginTop: "16px" }}>
                      <Button onClick={() => loadFiles()}>
                        {t("MediaPicker.retry", "Try again")}
                      </Button>
                    </div>
                  </div>
                ) : files.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center" }}>
                    <Text variant="bodyMd" tone="subdued" as="p">
                      {t("MediaPicker.noFiles", "No files found. Upload some files first.")}
                    </Text>
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      {files.map((file) => (
                        <div
                          key={file.id}
                          onClick={() => setSelectedFile(file)}
                          style={{
                            padding: "8px",
                            borderRadius: "8px",
                            border: selectedFile?.id === file.id
                              ? "2px solid var(--p-color-border-interactive)"
                              : "2px solid transparent",
                            backgroundColor: selectedFile?.id === file.id
                              ? "var(--p-color-bg-surface-selected)"
                              : "var(--p-color-bg-surface-secondary)",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div
                            style={{
                              aspectRatio: "1",
                              borderRadius: "4px",
                              overflow: "hidden",
                              backgroundColor: "#f3f4f6",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {file.type === "video" ? (
                              file.preview ? (
                                <img
                                  src={file.preview}
                                  alt={file.alt || "Video thumbnail"}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : (
                                <Text variant="bodySm" tone="subdued">Video</Text>
                              )
                            ) : (
                              <img
                                src={file.url}
                                alt={file.alt || "Image"}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            )}
                          </div>
                          <div style={{ marginTop: "4px" }}>
                            <Text variant="bodySm" as="p" truncate>
                              {file.alt || "Untitled"}
                            </Text>
                          </div>
                        </div>
                      ))}
                    </div>

                    {pageInfo?.hasNextPage && (
                      <div style={{ marginTop: "20px", textAlign: "center" }}>
                        <Button onClick={handleLoadMore} loading={loadingFiles}>
                          {t("MediaPicker.loadMore", "Load more")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Tabs>
      </Modal.Section>
    </Modal>
  );
}
