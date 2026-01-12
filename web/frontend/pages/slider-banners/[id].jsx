import { useState, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";
import {
  Page,
  Layout,
  LegacyCard,
  FormLayout,
  TextField,
  Select,
  Button,
  Banner,
  Text,
  Tabs,
  Divider,
  Checkbox,
  LegacyStack,
  ChoiceList,
  SkeletonPage,
  SkeletonBodyText,
} from "@shopify/polaris";
import { useAuthenticatedFetch } from "../../hooks/useAuthenticatedFetch";
import { MediaPicker } from "../../components/MediaPicker";

const DESKTOP_ASPECT_RATIOS = [
  { label: "Select ratio", value: "" },
  { label: "16:9 (2480x1395 - 3840x2160px)", value: "16:9" },
  { label: "16:8 (2480x1240 - 3840x1920px)", value: "16:8" },
  { label: "16:7 (2480x1085 - 3840x1680px)", value: "16:7" },
  { label: "16:6 (2480x930 - 3840x1440px)", value: "16:6" },
];

const MOBILE_ASPECT_RATIOS = [
  { label: "Select ratio", value: "" },
  { label: "9:16 (1395x2480 - 2160x3840px)", value: "9:16" },
  { label: "1:1 (1395x1395 - 2160x2160px)", value: "1:1" },
];

const TRANSITION_EFFECTS = [
  { label: "Select an effect", value: "" },
  { label: "No Effect (Simple crossfade)", value: "no-effect" },
  { label: "Random Effect", value: "random" },
  { label: "Simple fade transition", value: "simple-fade" },
  { label: "Vertical stripes grow down, animated left to right", value: "v-grow-down-ltr" },
  { label: "Vertical stripes grow down, animated right to left", value: "v-grow-down-rtl" },
  { label: "Vertical stripes grow down, animated random order", value: "v-grow-down-random" },
  { label: "Vertical stripes move down, animated left to right", value: "v-move-down-ltr" },
  { label: "Vertical stripes move down, animated right to left", value: "v-move-down-rtl" },
  { label: "Vertical stripes move down, animated random order", value: "v-move-down-random" },
  { label: "Vertical stripes grow up, animated left to right", value: "v-grow-up-ltr" },
  { label: "Vertical stripes grow up, animated right to left", value: "v-grow-up-rtl" },
  { label: "Vertical stripes grow up, animated random order", value: "v-grow-up-random" },
  { label: "Vertical stripes move up, animated left to right", value: "v-move-up-ltr" },
  { label: "Vertical stripes move up, animated right to left", value: "v-move-up-rtl" },
  { label: "Vertical stripes move up, animated random order", value: "v-move-up-random" },
  { label: "Vertical stripes grow into each other up and down, animated left to right", value: "v-grow-into-ltr" },
  { label: "Vertical stripes grow into each other up and down, animated right to left", value: "v-grow-into-rtl" },
  { label: "Vertical stripes move into each other up and down, animated left to right", value: "v-move-into-ltr" },
  { label: "Vertical stripes move into each other up and down, animated right to left", value: "v-move-into-rtl" },
  { label: "Vertical stripes fold from left to right", value: "v-fold-ltr" },
  { label: "Vertical stripes fold from right to left", value: "v-fold-rtl" },
  { label: "Horizontal stripes grow left to right, animated top to bottom", value: "h-grow-ltr-ttb" },
  { label: "Horizontal stripes grow left to right, animated bottom to top", value: "h-grow-ltr-btt" },
  { label: "Horizontal stripes grow left to right, animated random order", value: "h-grow-ltr-random" },
  { label: "Horizontal stripes move left to right, animated top to bottom", value: "h-move-ltr-ttb" },
  { label: "Horizontal stripes move left to right, animated bottom to top", value: "h-move-ltr-btt" },
  { label: "Horizontal stripes move left to right, animated random order", value: "h-move-ltr-random" },
  { label: "Horizontal stripes grow right to left, animated top to bottom", value: "h-grow-rtl-ttb" },
  { label: "Horizontal stripes grow right to left, animated bottom to top", value: "h-grow-rtl-btt" },
  { label: "Horizontal stripes grow right to left, animated random order", value: "h-grow-rtl-random" },
  { label: "Horizontal stripes move right to left, animated top to bottom", value: "h-move-rtl-ttb" },
  { label: "Horizontal stripes move right to left, animated bottom to top", value: "h-move-rtl-btt" },
  { label: "Horizontal stripes move right to left, animated random order", value: "h-move-rtl-random" },
  { label: "Horizontal stripes grow into each other left and right, animated top to bottom", value: "h-grow-into-ttb" },
  { label: "Horizontal stripes grow into each other left and right, animated bottom to top", value: "h-grow-into-btt" },
  { label: "Horizontal stripes move into each other left and right, animated top to bottom", value: "h-move-into-ttb" },
  { label: "Horizontal stripes move into each other left and right, animated bottom to top", value: "h-move-into-btt" },
];

const LINK_OPTIONS = [
  { label: "No link", value: "" },
  { label: "External URL", value: "external" },
  { label: "Product Type", value: "productType" },
  { label: "Collection", value: "collection" },
  { label: "Category", value: "category" },
  { label: "Homepage", value: "homepage" },
  { label: "Newsletter Form", value: "newsletter" },
];

const TEXT_SIZES = [
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
];

const BUTTON_PLACEMENTS = [
  { label: "Center", value: "center" },
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Bottom Left", value: "bottom-left" },
  { label: "Bottom Center", value: "bottom-center" },
  { label: "Bottom Right", value: "bottom-right" },
];

// Helper to format date for datetime-local input (displays UTC time directly)
function formatDateForInput(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Slide component
function SlideCard({ slide, index, onUpdate, onRemove, canRemove, collections, productTypes }) {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState(0);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const tabs = [
    { id: "desktop", content: t("SliderBanner.form.desktop") },
    { id: "mobile", content: t("SliderBanner.form.mobile") },
  ];

  const currentDevice = selectedTab === 0 ? "desktop" : "mobile";
  const deviceData = slide[currentDevice];

  const handleDeviceUpdate = (field, value) => {
    onUpdate(index, {
      ...slide,
      [currentDevice]: {
        ...deviceData,
        [field]: value,
      },
    });
  };

  const handleFieldUpdate = (field, value) => {
    onUpdate(index, {
      ...slide,
      [field]: value,
    });
  };

  const handleMediaSelect = (media) => {
    handleDeviceUpdate("media", {
      url: media.url,
      type: media.type,
      alt: media.alt,
      id: media.id,
    });
  };

  const handleRemoveMedia = () => {
    handleDeviceUpdate("media", null);
  };

  return (
    <LegacyCard sectioned>
      <LegacyStack vertical spacing="loose">
        <LegacyStack distribution="equalSpacing" alignment="center">
          <LegacyStack spacing="tight" alignment="center">
            <span style={{ cursor: "grab", color: "#6b7280" }}>≡</span>
            <Text variant="headingSm" as="h3">
              {t("SliderBanner.form.slide")} {index + 1}
            </Text>
          </LegacyStack>
          {canRemove && (
            <Button variant="plain" tone="critical" onClick={() => onRemove(index)}>
              Remove
            </Button>
          )}
        </LegacyStack>

        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
          <div style={{ paddingTop: "16px" }}>
            <LegacyStack vertical spacing="loose">
              {/* Media Upload */}
              <div>
                <Text variant="bodyMd" fontWeight="semibold" as="p">
                  {t("SliderBanner.form.mediaUpload")} *
                </Text>
                {deviceData.media ? (
                  <div style={{ marginTop: "8px", position: "relative" }}>
                    {(() => {
                      const mediaUrl = deviceData.media.url || deviceData.media.preview;
                      const isVideo = deviceData.media.type === "video" || deviceData.media.type?.startsWith("video/");
                      const mediaLabel = deviceData.media.alt || deviceData.media.name || "Media selected";

                      return (
                        <>
                          {isVideo ? (
                            <video
                              src={mediaUrl}
                              style={{
                                width: "100%",
                                maxHeight: "200px",
                                objectFit: "contain",
                                borderRadius: "8px",
                                backgroundColor: "#f3f4f6",
                              }}
                              controls
                            />
                          ) : (
                            <img
                              src={mediaUrl}
                              alt={mediaLabel}
                              style={{
                                width: "100%",
                                maxHeight: "200px",
                                objectFit: "contain",
                                borderRadius: "8px",
                                backgroundColor: "#f3f4f6",
                              }}
                            />
                          )}
                          <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Text variant="bodySm" tone="subdued" as="span">
                              {mediaLabel}
                            </Text>
                            <LegacyStack spacing="tight">
                              <Button variant="plain" onClick={() => setMediaPickerOpen(true)}>
                                Change
                              </Button>
                              <Button variant="plain" tone="critical" onClick={handleRemoveMedia}>
                                Remove
                              </Button>
                            </LegacyStack>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div
                    onClick={() => setMediaPickerOpen(true)}
                    style={{
                      marginTop: "8px",
                      border: "2px dashed #d1d5db",
                      borderRadius: "8px",
                      padding: "40px 20px",
                      textAlign: "center",
                      cursor: "pointer",
                      backgroundColor: "#fafafa",
                      display: "block",
                    }}
                  >
                    <Text variant="bodyMd" tone="subdued" as="p">
                      {t("SliderBanner.form.mediaUploadText")}
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      {t("SliderBanner.form.mediaUploadFormats")}
                    </Text>
                  </div>
                )}
                <MediaPicker
                  open={mediaPickerOpen}
                  onClose={() => setMediaPickerOpen(false)}
                  onSelect={handleMediaSelect}
                  allowedTypes={["image", "video"]}
                />
              </div>

              {/* Link */}
              <Select
                label={t("SliderBanner.form.link")}
                options={LINK_OPTIONS}
                value={slide.linkType}
                onChange={(value) => handleFieldUpdate("linkType", value)}
              />

              {slide.linkType === "external" && (
                <TextField
                  label="URL"
                  value={slide.linkValue}
                  onChange={(value) => handleFieldUpdate("linkValue", value)}
                  placeholder="https://example.com"
                />
              )}

              {slide.linkType === "productType" && productTypes.length > 0 && (
                <Select
                  label="Select Product Type"
                  options={[
                    { label: "Choose a product type", value: "" },
                    ...productTypes.map((type) => ({
                      label: type,
                      value: type,
                    })),
                  ]}
                  value={slide.linkValue}
                  onChange={(value) => handleFieldUpdate("linkValue", value)}
                />
              )}

              {slide.linkType === "collection" && collections.length > 0 && (
                <Select
                  label="Select Collection"
                  options={[
                    { label: "Choose a collection", value: "" },
                    ...collections.map((col) => ({
                      label: col.title,
                      value: col.handle,
                    })),
                  ]}
                  value={slide.linkValue}
                  onChange={(value) => handleFieldUpdate("linkValue", value)}
                />
              )}

              <Divider />

              {/* Add Button Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text variant="bodyMd" as="span">
                  {t("SliderBanner.form.addButton")}
                </Text>
                <div
                  onClick={() => handleFieldUpdate("buttonEnabled", !slide.buttonEnabled)}
                  style={{
                    width: "44px",
                    height: "24px",
                    borderRadius: "12px",
                    backgroundColor: slide.buttonEnabled ? "#2e7d32" : "#9ca3af",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background-color 0.2s",
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "white",
                      position: "absolute",
                      top: "2px",
                      left: slide.buttonEnabled ? "22px" : "2px",
                      transition: "left 0.2s",
                    }}
                  />
                </div>
              </div>

              {slide.buttonEnabled && (
                <LegacyStack vertical spacing="loose">
                  <TextField
                    label="Button Text"
                    value={slide.buttonText}
                    onChange={(value) => handleFieldUpdate("buttonText", value)}
                    placeholder="Shop Now"
                  />

                  <FormLayout>
                    <FormLayout.Group>
                      <div>
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          Background Color
                        </Text>
                        <div style={{ marginTop: "4px" }}>
                          <input
                            type="color"
                            value={slide.buttonBgColor || "#2e7d32"}
                            onChange={(e) => handleFieldUpdate("buttonBgColor", e.target.value)}
                            style={{
                              width: "100%",
                              height: "40px",
                              border: "1px solid #c4cdd5",
                              borderRadius: "8px",
                              cursor: "pointer",
                              padding: "4px",
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          Text Color
                        </Text>
                        <div style={{ marginTop: "4px" }}>
                          <input
                            type="color"
                            value={slide.buttonTextColor || "#ffffff"}
                            onChange={(e) => handleFieldUpdate("buttonTextColor", e.target.value)}
                            style={{
                              width: "100%",
                              height: "40px",
                              border: "1px solid #c4cdd5",
                              borderRadius: "8px",
                              cursor: "pointer",
                              padding: "4px",
                            }}
                          />
                        </div>
                      </div>
                    </FormLayout.Group>
                  </FormLayout>

                  <FormLayout>
                    <FormLayout.Group>
                      <Select
                        label="Text Size"
                        options={TEXT_SIZES}
                        value={slide.buttonTextSize || "16px"}
                        onChange={(value) => handleFieldUpdate("buttonTextSize", value)}
                      />
                      <Select
                        label="Placement"
                        options={BUTTON_PLACEMENTS}
                        value={slide.buttonPlacement || "center"}
                        onChange={(value) => handleFieldUpdate("buttonPlacement", value)}
                      />
                    </FormLayout.Group>
                  </FormLayout>
                </LegacyStack>
              )}
            </LegacyStack>
          </div>
        </Tabs>
      </LegacyStack>
    </LegacyCard>
  );
}

export default function EditSliderBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const authenticatedFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  // Format Selection
  const [desktopAspectRatio, setDesktopAspectRatio] = useState("");
  const [mobileAspectRatio, setMobileAspectRatio] = useState("");

  // Basic Information
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(false);

  // Slider Settings
  const [addBorder, setAddBorder] = useState(false);
  const [transitionEffect, setTransitionEffect] = useState("");
  const [delayBetweenSlides, setDelayBetweenSlides] = useState("5");

  // Slides
  const [slides, setSlides] = useState([]);

  // Scheduling
  const [schedulingEnabled, setSchedulingEnabled] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Assignment
  const [assignment, setAssignment] = useState({
    homepage: false,
    productTypes: [],
    collections: [],
    categories: [],
    vendors: [],
  });

  // UI state
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Fetch the slider banner data
  const {
    data: sliderData,
    isLoading: isLoadingSlider,
    isError: isSliderError,
  } = useQuery({
    queryKey: ["sliderBanner", id],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/slider-banners/${id}`);
      if (!response.ok) throw new Error("Failed to fetch slider banner");
      return await response.json();
    },
    refetchOnWindowFocus: false,
    staleTime: 0,
    cacheTime: 0,
  });

  // Fetch collections
  const { data: collectionsData } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const response = await authenticatedFetch("/api/collections");
      if (!response.ok) return { collections: [] };
      return await response.json();
    },
    refetchOnWindowFocus: false,
  });

  // Fetch product types
  const { data: productTypesData } = useQuery({
    queryKey: ["productTypes"],
    queryFn: async () => {
      const response = await authenticatedFetch("/api/product-types");
      if (!response.ok) return { productTypes: [] };
      return await response.json();
    },
    refetchOnWindowFocus: false,
  });

  const collections = collectionsData?.collections || [];
  const productTypes = productTypesData?.productTypes || [];

  // Reset dataLoaded when id changes
  useEffect(() => {
    setDataLoaded(false);
  }, [id]);

  // Load slider data into form state
  useEffect(() => {
    if (sliderData?.sliderBanner && !dataLoaded) {
      const slider = sliderData.sliderBanner;

      setName(slider.name || "");
      setEnabled(slider.status !== false);
      setDesktopAspectRatio(slider.desktopAspectRatio || "");
      setMobileAspectRatio(slider.mobileAspectRatio || "");
      setAddBorder(slider.addBorder || false);
      setTransitionEffect(slider.transitionEffect || "");
      setDelayBetweenSlides(String(slider.delayBetweenSlides || 5));

      // Parse slides
      const slidesArr = slider.slides || [];
      if (slidesArr.length > 0) {
        setSlides(slidesArr.map((slide, index) => ({
          id: index + 1,
          desktop: slide.desktop || { media: null },
          mobile: slide.mobile || { media: null },
          linkType: slide.linkType || "",
          linkValue: slide.linkValue || "",
          buttonEnabled: slide.buttonEnabled || false,
          buttonText: slide.buttonText || "",
          buttonBgColor: slide.buttonBgColor || "#2e7d32",
          buttonTextColor: slide.buttonTextColor || "#ffffff",
          buttonTextSize: slide.buttonTextSize || "16px",
          buttonPlacement: slide.buttonPlacement || "center",
        })));
      } else {
        setSlides([
          {
            id: 1,
            desktop: { media: null },
            mobile: { media: null },
            linkType: "",
            linkValue: "",
            buttonEnabled: false,
            buttonText: "",
            buttonBgColor: "#2e7d32",
            buttonTextColor: "#ffffff",
            buttonTextSize: "16px",
            buttonPlacement: "center",
          },
          {
            id: 2,
            desktop: { media: null },
            mobile: { media: null },
            linkType: "",
            linkValue: "",
            buttonEnabled: false,
            buttonText: "",
            buttonBgColor: "#2e7d32",
            buttonTextColor: "#ffffff",
            buttonTextSize: "16px",
            buttonPlacement: "center",
          },
        ]);
      }

      // Scheduling
      setSchedulingEnabled(slider.schedulingEnabled || false);
      setStartDate(formatDateForInput(slider.startDate));
      setEndDate(formatDateForInput(slider.endDate));

      // Assignment
      setAssignment(slider.assignment || {
        homepage: false,
        productTypes: [],
        collections: [],
        categories: [],
        vendors: [],
      });

      setDataLoaded(true);
    }
  }, [sliderData, dataLoaded]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await authenticatedFetch(`/api/slider-banners/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update");
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["sliderBanners"]);
      queryClient.invalidateQueries(["sliderBanner", id]);
      navigate("/");
    },
    onError: (err) => {
      setError(err.message);
      setSaving(false);
    },
  });

  const handleSlideUpdate = useCallback((index, updatedSlide) => {
    setSlides((prev) => {
      const newSlides = [...prev];
      newSlides[index] = updatedSlide;
      return newSlides;
    });
  }, []);

  const handleSlideRemove = useCallback((index) => {
    setSlides((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddSlide = useCallback(() => {
    setSlides((prev) => [
      ...prev,
      {
        id: Date.now(),
        desktop: { media: null },
        mobile: { media: null },
        linkType: "",
        linkValue: "",
        buttonEnabled: false,
        buttonText: "",
        buttonBgColor: "#2e7d32",
        buttonTextColor: "#ffffff",
        buttonTextSize: "16px",
        buttonPlacement: "center",
      },
    ]);
  }, []);

  const handleAssignmentChange = (key, value) => {
    setAssignment((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    // Prepare slides data - preserve media object (supports both Shopify CDN URLs and legacy base64)
    const slidesData = slides.map((slide) => ({
      ...slide,
      desktop: {
        ...slide.desktop,
        media: slide.desktop.media
          ? {
              // New Shopify Files API format
              url: slide.desktop.media.url,
              id: slide.desktop.media.id,
              alt: slide.desktop.media.alt,
              // Legacy base64 format (backward compatibility)
              preview: slide.desktop.media.preview,
              name: slide.desktop.media.name,
              // Common field
              type: slide.desktop.media.type,
            }
          : null,
      },
      mobile: {
        ...slide.mobile,
        media: slide.mobile.media
          ? {
              // New Shopify Files API format
              url: slide.mobile.media.url,
              id: slide.mobile.media.id,
              alt: slide.mobile.media.alt,
              // Legacy base64 format (backward compatibility)
              preview: slide.mobile.media.preview,
              name: slide.mobile.media.name,
              // Common field
              type: slide.mobile.media.type,
            }
          : null,
      },
    }));

    const data = {
      name: name.trim(),
      status: enabled,
      desktopAspectRatio,
      mobileAspectRatio,
      addBorder,
      transitionEffect,
      delayBetweenSlides: parseInt(delayBetweenSlides, 10) || 5,
      slides: slidesData,
      schedulingEnabled,
      startDate: schedulingEnabled && startDate ? startDate + ":00.000Z" : null,
      endDate: schedulingEnabled && endDate ? endDate + ":00.000Z" : null,
      assignment,
    };

    updateMutation.mutate(data);
  }, [
    name,
    enabled,
    desktopAspectRatio,
    mobileAspectRatio,
    addBorder,
    transitionEffect,
    delayBetweenSlides,
    slides,
    schedulingEnabled,
    startDate,
    endDate,
    assignment,
    updateMutation,
  ]);

  // Loading state
  if (isLoadingSlider) {
    return (
      <SkeletonPage primaryAction backAction>
        <Layout>
          <Layout.Section>
            <LegacyCard sectioned>
              <SkeletonBodyText lines={6} />
            </LegacyCard>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  // Error state
  if (isSliderError) {
    return (
      <Page
        title={t("SliderBanner.edit.title")}
        backAction={{ content: "Back", onAction: () => navigate("/") }}
      >
        <Layout>
          <Layout.Section>
            <Banner tone="critical">
              Failed to load slider banner. Please try again.
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title={t("SliderBanner.edit.title")}
      backAction={{ content: "Back", onAction: () => navigate("/") }}
      primaryAction={{
        content: t("SliderBanner.form.save"),
        onAction: handleSave,
        loading: saving,
      }}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        {/* Format Selection */}
        <Layout.Section>
          <LegacyCard sectioned>
            <LegacyStack vertical spacing="loose">
              <Text variant="headingMd" as="h2">
                {t("SliderBanner.form.formatSelection")}
              </Text>
              <Text variant="bodySm" tone="subdued" as="p">
                {t("SliderBanner.form.formatDescription")}
              </Text>

              <FormLayout>
                <FormLayout.Group>
                  <Select
                    label={t("SliderBanner.form.desktopAspectRatio") + " *"}
                    options={DESKTOP_ASPECT_RATIOS}
                    value={desktopAspectRatio}
                    onChange={setDesktopAspectRatio}
                  />
                  <Select
                    label={t("SliderBanner.form.mobileAspectRatio") + " *"}
                    options={MOBILE_ASPECT_RATIOS}
                    value={mobileAspectRatio}
                    onChange={setMobileAspectRatio}
                  />
                </FormLayout.Group>
              </FormLayout>

              <div
                style={{
                  backgroundColor: "#f3f4f6",
                  padding: "12px 16px",
                  borderRadius: "8px",
                }}
              >
                <Text variant="bodyMd" fontWeight="semibold" as="p">
                  {t("SliderBanner.form.imageRequirements")}
                </Text>
                <Text variant="bodySm" as="p">
                  <strong>{t("SliderBanner.form.resolution")}:</strong> 72 dpi
                </Text>
                <Text variant="bodySm" as="p">
                  <strong>{t("SliderBanner.form.maxSlides")}:</strong> 20 for desktop, 20 for mobile
                </Text>
              </div>
            </LegacyStack>
          </LegacyCard>
        </Layout.Section>

        {/* Basic Information */}
        <Layout.Section>
          <LegacyCard sectioned>
            <LegacyStack vertical spacing="loose">
              <Text variant="headingMd" as="h2">
                {t("SliderBanner.form.basicInfo")}
              </Text>

              <TextField
                label={t("SliderBanner.form.name") + " *"}
                value={name}
                onChange={setName}
                placeholder={t("SliderBanner.form.namePlaceholder")}
                helpText={t("SliderBanner.form.nameHelpText")}
                requiredIndicator
              />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text variant="bodyMd" as="span">
                  {t("SliderBanner.form.enableSlider")}
                </Text>
                <div
                  onClick={() => setEnabled(!enabled)}
                  style={{
                    width: "44px",
                    height: "24px",
                    borderRadius: "12px",
                    backgroundColor: enabled ? "#2e7d32" : "#9ca3af",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background-color 0.2s",
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "white",
                      position: "absolute",
                      top: "2px",
                      left: enabled ? "22px" : "2px",
                      transition: "left 0.2s",
                    }}
                  />
                </div>
              </div>
            </LegacyStack>
          </LegacyCard>
        </Layout.Section>

        {/* Slider Settings */}
        <Layout.Section>
          <LegacyCard sectioned>
            <LegacyStack vertical spacing="loose">
              <Text variant="headingMd" as="h2">
                {t("SliderBanner.form.sliderSettings")}
              </Text>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text variant="bodyMd" as="span">
                  {t("SliderBanner.form.addBorder")}
                </Text>
                <div
                  onClick={() => setAddBorder(!addBorder)}
                  style={{
                    width: "44px",
                    height: "24px",
                    borderRadius: "12px",
                    backgroundColor: addBorder ? "#2e7d32" : "#9ca3af",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background-color 0.2s",
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "white",
                      position: "absolute",
                      top: "2px",
                      left: addBorder ? "22px" : "2px",
                      transition: "left 0.2s",
                    }}
                  />
                </div>
              </div>

              <Select
                label={t("SliderBanner.form.transitionEffect")}
                options={TRANSITION_EFFECTS}
                value={transitionEffect}
                onChange={setTransitionEffect}
              />

              <TextField
                label={t("SliderBanner.form.delayBetweenSlides")}
                type="number"
                value={delayBetweenSlides}
                onChange={setDelayBetweenSlides}
                helpText={t("SliderBanner.form.delayHelpText")}
                min={1}
                max={30}
              />
            </LegacyStack>
          </LegacyCard>
        </Layout.Section>

        {/* Slides */}
        <Layout.Section>
          <LegacyCard sectioned>
            <LegacyStack vertical spacing="loose">
              <Text variant="headingMd" as="h2">
                {t("SliderBanner.form.slides")}
              </Text>
              <Text variant="bodySm" tone="subdued" as="p">
                {t("SliderBanner.form.slidesMinimum")}
              </Text>

              {slides.map((slide, index) => (
                <SlideCard
                  key={slide.id}
                  slide={slide}
                  index={index}
                  onUpdate={handleSlideUpdate}
                  onRemove={handleSlideRemove}
                  canRemove={slides.length > 2}
                  collections={collections}
                  productTypes={productTypes}
                />
              ))}

              <Button fullWidth variant="secondary" onClick={handleAddSlide}>
                {t("SliderBanner.form.addSlide")}
              </Button>
            </LegacyStack>
          </LegacyCard>
        </Layout.Section>

        {/* Scheduling */}
        <Layout.Section>
          <LegacyCard sectioned>
            <LegacyStack vertical spacing="loose">
              <Text variant="headingMd" as="h2">
                {t("SliderBanner.form.scheduling")}
              </Text>

              <Checkbox
                label={t("SliderBanner.form.scheduleSlider")}
                checked={schedulingEnabled}
                onChange={setSchedulingEnabled}
              />

              {schedulingEnabled && (
                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label={t("SliderBanner.form.startDate")}
                      type="datetime-local"
                      value={startDate}
                      onChange={setStartDate}
                      helpText="All times are in UTC"
                    />
                    <TextField
                      label={t("SliderBanner.form.endDate")}
                      type="datetime-local"
                      value={endDate}
                      onChange={setEndDate}
                      helpText="All times are in UTC"
                    />
                  </FormLayout.Group>
                </FormLayout>
              )}
            </LegacyStack>
          </LegacyCard>
        </Layout.Section>

        {/* Assignment / Targeting */}
        <Layout.Section>
          <LegacyCard sectioned>
            <LegacyStack vertical spacing="loose">
              <Text variant="headingMd" as="h2">
                {t("SliderBanner.form.assignment")}
              </Text>
              <Text variant="bodySm" tone="subdued" as="p">
                {t("SliderBanner.form.assignmentDescription")}
              </Text>

              <Checkbox
                label={t("SliderBanner.form.homepage")}
                checked={assignment.homepage}
                onChange={(value) => handleAssignmentChange("homepage", value)}
              />

              <div>
                <Checkbox
                  label={t("SliderBanner.form.productTypes")}
                  checked={assignment.productTypes.length > 0}
                  onChange={(checked) => {
                    if (!checked) {
                      handleAssignmentChange("productTypes", []);
                    }
                  }}
                />
                {productTypes.length > 0 && (
                  <div style={{ marginLeft: "28px", marginTop: "8px" }}>
                    <ChoiceList
                      allowMultiple
                      choices={productTypes.map((type) => ({
                        label: type,
                        value: type,
                      }))}
                      selected={assignment.productTypes}
                      onChange={(value) => handleAssignmentChange("productTypes", value)}
                    />
                  </div>
                )}
              </div>

              <div>
                <Checkbox
                  label={t("SliderBanner.form.collections")}
                  checked={assignment.collections.length > 0}
                  onChange={(checked) => {
                    if (!checked) {
                      handleAssignmentChange("collections", []);
                    }
                  }}
                />
                {collections.length > 0 && (
                  <div style={{ marginLeft: "28px", marginTop: "8px" }}>
                    <ChoiceList
                      allowMultiple
                      choices={collections.map((col) => ({
                        label: col.title,
                        value: col.handle,
                      }))}
                      selected={assignment.collections}
                      onChange={(value) => handleAssignmentChange("collections", value)}
                    />
                  </div>
                )}
              </div>
            </LegacyStack>
          </LegacyCard>
        </Layout.Section>

        {/* Footer Buttons */}
        <Layout.Section>
          <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "20px" }}>
            <Button onClick={() => navigate("/")}>
              {t("SliderBanner.form.cancel")}
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {t("SliderBanner.form.save")}
            </Button>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
