import { useState, useCallback, useEffect, useRef } from "react";
import {
  Modal,
  DropZone,
  Text,
  Button,
  Spinner,
  InlineError,
  TextField,
  Icon,
  ButtonGroup,
  Badge,
  ProgressBar,
} from "@shopify/polaris";
import { SearchIcon, ImageIcon, PlayIcon } from "@shopify/polaris-icons";
import { useAuthenticatedFetch } from "../hooks/useAuthenticatedFetch";
import { useTranslation } from "react-i18next";

export function MediaPicker({ open, onClose, onSelect, allowedTypes = ["image", "video"] }) {
  const { t } = useTranslation();
  const authenticatedFetch = useAuthenticatedFetch();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [pageInfo, setPageInfo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const searchTimeoutRef = useRef(null);

  const acceptedTypes = [];
  if (allowedTypes.includes("image")) {
    acceptedTypes.push("image/jpeg", "image/png", "image/webp", "image/gif");
  }
  if (allowedTypes.includes("video")) {
    acceptedTypes.push("video/mp4", "video/webm");
  }

  // Load files on mount and when filter/search changes
  const loadFiles = useCallback(async (cursor = null, append = false) => {
    setLoadingFiles(true);
    setFilesError(null);
    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (searchQuery) params.set("search", searchQuery);
      if (activeFilter !== "all") params.set("type", activeFilter);

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
  }, [authenticatedFetch, searchQuery, activeFilter, allowedTypes]);

  // Load files when modal opens
  useEffect(() => {
    if (open) {
      loadFiles();
      setSelectedFile(null);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      if (open) {
        loadFiles();
      }
    }, 300);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery, activeFilter]);

  const handleDrop = useCallback(async (_dropFiles, acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      // Step 1: Get staged upload URL
      setUploadProgress(10);
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
      setUploadProgress(30);
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
      setUploadProgress(70);
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
      setUploadProgress(100);

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
      setUploadProgress(0);
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

  const handleLoadMore = useCallback(() => {
    if (pageInfo?.hasNextPage) {
      loadFiles(pageInfo.endCursor, true);
    }
  }, [loadFiles, pageInfo]);

  const handleFilterChange = useCallback((filter) => {
    setActiveFilter(filter);
    setSelectedFile(null);
  }, []);

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Render file thumbnail with metadata
  const renderFileThumbnail = (file) => {
    const isSelected = selectedFile?.id === file.id;
    const isVideo = file.type === "video";

    return (
      <div
        key={file.id}
        onClick={() => setSelectedFile(file)}
        style={{
          position: "relative",
          borderRadius: "8px",
          border: isSelected
            ? "2px solid var(--p-color-border-interactive)"
            : "2px solid var(--p-color-border-subdued)",
          backgroundColor: isSelected
            ? "var(--p-color-bg-surface-selected)"
            : "var(--p-color-bg-surface)",
          cursor: "pointer",
          transition: "all 0.15s ease",
          overflow: "hidden",
        }}
        onMouseOver={(e) => {
          if (!isSelected) {
            e.currentTarget.style.borderColor = "var(--p-color-border-hover)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
          }
        }}
        onMouseOut={(e) => {
          if (!isSelected) {
            e.currentTarget.style.borderColor = "var(--p-color-border-subdued)";
            e.currentTarget.style.boxShadow = "none";
          }
        }}
      >
        {/* Thumbnail */}
        <div
          style={{
            aspectRatio: "4/3",
            backgroundColor: "#f3f4f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {isVideo ? (
            file.preview ? (
              <>
                <img
                  src={file.preview}
                  alt={file.alt || "Video thumbnail"}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                {/* Play icon overlay */}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "40px",
                    height: "40px",
                    backgroundColor: "rgba(0,0,0,0.6)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon source={PlayIcon} tone="base" />
                </div>
              </>
            ) : (
              <div style={{ color: "#9ca3af" }}>
                <Icon source={PlayIcon} tone="subdued" />
              </div>
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

          {/* Video badge */}
          {isVideo && (
            <div
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                backgroundColor: "rgba(0,0,0,0.7)",
                color: "#fff",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: "500",
              }}
            >
              VIDEO
            </div>
          )}

          {/* Selection checkmark */}
          {isSelected && (
            <div
              style={{
                position: "absolute",
                top: "8px",
                left: "8px",
                width: "20px",
                height: "20px",
                backgroundColor: "var(--p-color-bg-fill-success)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
        </div>

        {/* File info */}
        <div style={{ padding: "8px" }}>
          <Text variant="bodySm" as="p" truncate fontWeight="medium">
            {file.alt || "Untitled"}
          </Text>
          <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
            <Text variant="bodySm" tone="subdued" as="span">
              {isVideo ? "MP4" : file.mimeType?.split("/")[1]?.toUpperCase() || "IMG"}
            </Text>
          </div>
        </div>
      </div>
    );
  };

  // Loading skeleton
  const renderSkeleton = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: "16px",
      }}
    >
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          style={{
            borderRadius: "8px",
            border: "2px solid var(--p-color-border-subdued)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              aspectRatio: "4/3",
              backgroundColor: "#e5e7eb",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          <div style={{ padding: "8px" }}>
            <div
              style={{
                height: "14px",
                backgroundColor: "#e5e7eb",
                borderRadius: "4px",
                width: "80%",
              }}
            />
            <div
              style={{
                height: "12px",
                backgroundColor: "#e5e7eb",
                borderRadius: "4px",
                width: "40%",
                marginTop: "4px",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("MediaPicker.title", "Select file")}
      primaryAction={
        selectedFile
          ? {
              content: t("MediaPicker.done", "Done"),
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
        {/* Search bar */}
        <div style={{ marginBottom: "16px" }}>
          <TextField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("MediaPicker.searchPlaceholder", "Search files")}
            prefix={<Icon source={SearchIcon} />}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearchQuery("")}
          />
        </div>

        {/* Filter buttons */}
        <div style={{ marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
          <Text variant="bodySm" fontWeight="medium" as="span">
            {t("MediaPicker.fileType", "File type")}
          </Text>
          <ButtonGroup segmented>
            <Button
              pressed={activeFilter === "all"}
              onClick={() => handleFilterChange("all")}
              size="slim"
            >
              {t("MediaPicker.all", "All")}
            </Button>
            {allowedTypes.includes("image") && (
              <Button
                pressed={activeFilter === "image"}
                onClick={() => handleFilterChange("image")}
                size="slim"
              >
                {t("MediaPicker.images", "Images")}
              </Button>
            )}
            {allowedTypes.includes("video") && (
              <Button
                pressed={activeFilter === "video"}
                onClick={() => handleFilterChange("video")}
                size="slim"
              >
                {t("MediaPicker.videos", "Videos")}
              </Button>
            )}
          </ButtonGroup>
        </div>

        {/* Upload area */}
        <div style={{ marginBottom: "20px" }}>
          <DropZone
            accept={acceptedTypes.join(",")}
            type="file"
            onDrop={handleDrop}
            disabled={uploading}
            variableHeight
          >
            {uploading ? (
              <div style={{ padding: "24px", textAlign: "center" }}>
                <div style={{ marginBottom: "12px" }}>
                  <ProgressBar progress={uploadProgress} size="small" />
                </div>
                <Text variant="bodySm" as="p">
                  {uploadProgress < 70
                    ? t("MediaPicker.uploading", "Uploading...")
                    : t("MediaPicker.processing", "Processing...")}
                </Text>
              </div>
            ) : (
              <div style={{ padding: "16px", textAlign: "center" }}>
                <Button>
                  {t("MediaPicker.addMedia", "Add media")}
                </Button>
                <div style={{ marginTop: "8px" }}>
                  <Text variant="bodySm" tone="subdued" as="p">
                    {t("MediaPicker.dropHint", "Drag and drop images and videos")}
                  </Text>
                </div>
              </div>
            )}
          </DropZone>
          {uploadError && (
            <div style={{ marginTop: "8px" }}>
              <InlineError message={uploadError} fieldID="upload-error" />
            </div>
          )}
        </div>

        {/* File grid */}
        <div style={{ minHeight: "300px" }}>
          {loadingFiles && files.length === 0 ? (
            renderSkeleton()
          ) : filesError ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <InlineError message={filesError} fieldID="files-error" />
              <div style={{ marginTop: "16px" }}>
                <Button onClick={() => loadFiles()}>
                  {t("MediaPicker.retry", "Try again")}
                </Button>
              </div>
            </div>
          ) : files.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <div style={{ marginBottom: "8px", color: "#9ca3af" }}>
                <Icon source={ImageIcon} />
              </div>
              <Text variant="bodyMd" tone="subdued" as="p">
                {searchQuery
                  ? t("MediaPicker.noResults", "No files match your search")
                  : t("MediaPicker.noFiles", "No files uploaded yet")}
              </Text>
              {searchQuery && (
                <div style={{ marginTop: "12px" }}>
                  <Button plain onClick={() => setSearchQuery("")}>
                    {t("MediaPicker.clearSearch", "Clear search")}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: "16px",
                }}
              >
                {files.map(renderFileThumbnail)}
              </div>

              {pageInfo?.hasNextPage && (
                <div style={{ marginTop: "20px", textAlign: "center" }}>
                  <Button onClick={handleLoadMore} loading={loadingFiles}>
                    {t("MediaPicker.loadMore", "Load more")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Modal.Section>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </Modal>
  );
}
