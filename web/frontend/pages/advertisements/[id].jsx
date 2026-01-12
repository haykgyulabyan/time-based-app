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
  Checkbox,
  LegacyStack,
  SkeletonPage,
  SkeletonBodyText,
} from "@shopify/polaris";
import { useAuthenticatedFetch } from "../../hooks/useAuthenticatedFetch";
import { MediaPicker } from "../../components/MediaPicker";

const AD_SIZES = [
  { label: "1x1 (350x525px)", value: "1x1" },
  { label: "2x1 (716x525px)", value: "2x1" },
  { label: "3x1 (1078x525px)", value: "3x1" },
  { label: "4x1 (1434x525px)", value: "4x1" },
];

const LINK_OPTIONS = [
  { label: "Select link type", value: "" },
  { label: "External URL", value: "external" },
  { label: "Product Type", value: "productType" },
  { label: "Collection", value: "collection" },
  { label: "Homepage", value: "homepage" },
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

// Helper to format date for datetime-local input
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

export default function EditAdvertisement() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const authenticatedFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  // Basic Information
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [size, setSize] = useState("1x1");

  // Media (Desktop/Mobile)
  const [selectedTab, setSelectedTab] = useState(0);
  const [desktopImage, setDesktopImage] = useState(null);
  const [mobileImage, setMobileImage] = useState(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  // Button Settings
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const [buttonText, setButtonText] = useState("");
  const [buttonLinkType, setButtonLinkType] = useState("");
  const [buttonLinkValue, setButtonLinkValue] = useState("");
  const [buttonBgColor, setButtonBgColor] = useState("#2e7d32");
  const [buttonTextColor, setButtonTextColor] = useState("#ffffff");
  const [buttonTextSize, setButtonTextSize] = useState("16px");
  const [buttonPlacement, setButtonPlacement] = useState("center");

  // Scheduling
  const [schedulingEnabled, setSchedulingEnabled] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // UI state
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Fetch advertisement data
  const {
    data: advertisementData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["advertisement", id],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/advertisements/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch advertisement");
      }
      return await response.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Fetch collections for link dropdown
  const { data: collectionsData } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const response = await authenticatedFetch("/api/collections");
      if (!response.ok) return { collections: [] };
      return await response.json();
    },
    refetchOnWindowFocus: false,
  });

  // Fetch product types for link dropdown
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

  // Load data into form
  useEffect(() => {
    if (advertisementData?.advertisement && !dataLoaded) {
      const ad = advertisementData.advertisement;
      setName(ad.name || "");
      setEnabled(ad.status ?? true);
      setSize(ad.size || "1x1");
      setDesktopImage(ad.desktopImage || null);
      setMobileImage(ad.mobileImage || null);
      setButtonEnabled(ad.buttonEnabled ?? false);
      setButtonText(ad.buttonText || "");
      setButtonLinkType(ad.buttonLinkType || "");
      setButtonLinkValue(ad.buttonLinkValue || "");
      setButtonBgColor(ad.buttonBgColor || "#2e7d32");
      setButtonTextColor(ad.buttonTextColor || "#ffffff");
      setButtonTextSize(ad.buttonTextSize || "16px");
      setButtonPlacement(ad.buttonPlacement || "center");
      setSchedulingEnabled(ad.schedulingEnabled ?? false);
      setStartDate(formatDateForInput(ad.startDate));
      setEndDate(formatDateForInput(ad.endDate));
      setDataLoaded(true);
    }
  }, [advertisementData, dataLoaded]);

  const tabs = [
    { id: "desktop", content: t("Advertisement.form.desktop", "Desktop") },
    { id: "mobile", content: t("Advertisement.form.mobile", "Mobile") },
  ];

  const currentDevice = selectedTab === 0 ? "desktop" : "mobile";
  const currentImage = currentDevice === "desktop" ? desktopImage : mobileImage;
  const setCurrentImage = currentDevice === "desktop" ? setDesktopImage : setMobileImage;

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const response = await authenticatedFetch(`/api/advertisements/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save");
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["advertisement", id]);
      queryClient.invalidateQueries(["advertisements"]);
      navigate("/");
    },
    onError: (err) => {
      setError(err.message);
      setSaving(false);
    },
  });

  const handleMediaSelect = (media) => {
    setCurrentImage({
      url: media.url,
      type: media.type,
      alt: media.alt,
      id: media.id,
    });
    setMediaPickerOpen(false);
  };

  const handleRemoveMedia = () => {
    setCurrentImage(null);
  };

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      setError(t("Advertisement.form.nameRequired", "Name is required"));
      return;
    }

    setSaving(true);
    setError(null);

    const data = {
      name: name.trim(),
      status: enabled,
      size,
      desktopImage: desktopImage
        ? {
            url: desktopImage.url,
            id: desktopImage.id,
            alt: desktopImage.alt,
            type: desktopImage.type,
          }
        : null,
      mobileImage: mobileImage
        ? {
            url: mobileImage.url,
            id: mobileImage.id,
            alt: mobileImage.alt,
            type: mobileImage.type,
          }
        : null,
      buttonEnabled,
      buttonText,
      buttonLinkType,
      buttonLinkValue,
      buttonBgColor,
      buttonTextColor,
      buttonTextSize,
      buttonPlacement,
      schedulingEnabled,
      startDate: schedulingEnabled && startDate ? startDate + ":00.000Z" : null,
      endDate: schedulingEnabled && endDate ? endDate + ":00.000Z" : null,
    };

    saveMutation.mutate(data);
  }, [
    name,
    enabled,
    size,
    desktopImage,
    mobileImage,
    buttonEnabled,
    buttonText,
    buttonLinkType,
    buttonLinkValue,
    buttonBgColor,
    buttonTextColor,
    buttonTextSize,
    buttonPlacement,
    schedulingEnabled,
    startDate,
    endDate,
    saveMutation,
    t,
  ]);

  if (isLoading) {
    return (
      <SkeletonPage primaryAction>
        <Layout>
          <Layout.Section>
            <LegacyCard sectioned>
              <SkeletonBodyText lines={4} />
            </LegacyCard>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  if (isError) {
    return (
      <Page
        title={t("Advertisement.edit.title", "Edit Advertisement")}
        backAction={{ content: "Back", onAction: () => navigate("/") }}
      >
        <Layout>
          <Layout.Section>
            <Banner tone="critical">
              {t("Advertisement.edit.loadError", "Failed to load advertisement")}
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title={t("Advertisement.edit.title", "Edit Advertisement")}
      backAction={{ content: "Back", onAction: () => navigate("/") }}
      primaryAction={{
        content: t("Advertisement.form.save", "Save Advertisement"),
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

        {/* Basic Information */}
        <Layout.Section>
          <LegacyCard sectioned>
            <LegacyStack vertical spacing="loose">
              <Text variant="headingMd" as="h2">
                {t("Advertisement.form.basicInfo", "Basic Information")}
              </Text>

              <TextField
                label={t("Advertisement.form.name", "Name") + " *"}
                value={name}
                onChange={setName}
                placeholder={t("Advertisement.form.namePlaceholder", "e.g., Holiday Sale Ad")}
                helpText={t("Advertisement.form.nameHelpText", "Internal name for your advertisement")}
                requiredIndicator
              />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text variant="bodyMd" as="span">
                  {t("Advertisement.form.enableAd", "Enable this advertisement")}
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

        {/* Media & Button */}
        <Layout.Section>
          <LegacyCard sectioned>
            <LegacyStack vertical spacing="loose">
              <Text variant="headingMd" as="h2">
                {t("Advertisement.form.mediaAndButton", "Media & Button")}
              </Text>

              <Text variant="bodySm" tone="subdued" as="p">
                {t(
                  "Advertisement.form.allowedSizes",
                  "Allowed sizes: 1x1 (350x525px), 2x1 (716x525px), 3x1 (1078x525px), 4x1 (1434x525px)"
                )}
              </Text>

              <Select
                label={t("Advertisement.form.size", "Advertisement Size")}
                options={AD_SIZES}
                value={size}
                onChange={setSize}
              />

              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
                <div style={{ paddingTop: "16px" }}>
                  <LegacyStack vertical spacing="loose">
                    {/* Media Upload */}
                    <div>
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        {t("Advertisement.form.uploadMedia", "Upload Media")} *
                      </Text>
                      {currentImage ? (
                        <div style={{ marginTop: "8px", position: "relative" }}>
                          <img
                            src={currentImage.url}
                            alt={currentImage.alt || "Advertisement image"}
                            style={{
                              width: "100%",
                              maxHeight: "200px",
                              objectFit: "contain",
                              borderRadius: "8px",
                              backgroundColor: "#f3f4f6",
                            }}
                          />
                          <div
                            style={{
                              marginTop: "8px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Text variant="bodySm" tone="subdued" as="span">
                              {currentImage.alt || "Image selected"}
                            </Text>
                            <LegacyStack spacing="tight">
                              <Button variant="plain" onClick={() => setMediaPickerOpen(true)}>
                                {t("Advertisement.form.change", "Change")}
                              </Button>
                              <Button variant="plain" tone="critical" onClick={handleRemoveMedia}>
                                {t("Advertisement.form.remove", "Remove")}
                              </Button>
                            </LegacyStack>
                          </div>
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
                            {t("Advertisement.form.clickToUpload", "Click to upload image")}
                          </Text>
                          <Text variant="bodySm" tone="subdued" as="p">
                            JPG, PNG, WebP
                          </Text>
                        </div>
                      )}
                      <MediaPicker
                        open={mediaPickerOpen}
                        onClose={() => setMediaPickerOpen(false)}
                        onSelect={handleMediaSelect}
                        allowedTypes={["image"]}
                      />
                    </div>
                  </LegacyStack>
                </div>
              </Tabs>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px", marginTop: "8px" }}>
                <Text variant="headingSm" as="h3">
                  {t("Advertisement.form.button", "Button")}
                </Text>

                <div style={{ marginTop: "12px" }}>
                  <TextField
                    label={t("Advertisement.form.buttonText", "Button Text")}
                    value={buttonText}
                    onChange={setButtonText}
                    placeholder={t("Advertisement.form.buttonTextPlaceholder", "e.g., Shop Now")}
                  />
                </div>

                <div style={{ marginTop: "12px" }}>
                  <Select
                    label={t("Advertisement.form.buttonLinkType", "Button Link Type")}
                    options={LINK_OPTIONS}
                    value={buttonLinkType}
                    onChange={(value) => {
                      setButtonLinkType(value);
                      setButtonLinkValue("");
                      setButtonEnabled(!!value);
                    }}
                  />
                </div>

                {buttonLinkType === "external" && (
                  <div style={{ marginTop: "12px" }}>
                    <TextField
                      label="URL"
                      value={buttonLinkValue}
                      onChange={setButtonLinkValue}
                      placeholder="https://example.com"
                    />
                  </div>
                )}

                {buttonLinkType === "productType" && productTypes.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <Select
                      label={t("Advertisement.form.selectProductType", "Select Product Type")}
                      options={[
                        { label: "Choose a product type", value: "" },
                        ...productTypes.map((type) => ({
                          label: type,
                          value: type,
                        })),
                      ]}
                      value={buttonLinkValue}
                      onChange={setButtonLinkValue}
                    />
                  </div>
                )}

                {buttonLinkType === "collection" && collections.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <Select
                      label={t("Advertisement.form.selectCollection", "Select Collection")}
                      options={[
                        { label: "Choose a collection", value: "" },
                        ...collections.map((col) => ({
                          label: col.title,
                          value: col.handle,
                        })),
                      ]}
                      value={buttonLinkValue}
                      onChange={setButtonLinkValue}
                    />
                  </div>
                )}

                {buttonLinkType && (
                  <>
                    <FormLayout>
                      <FormLayout.Group>
                        <div>
                          <Text variant="bodyMd" as="p" fontWeight="semibold">
                            {t("Advertisement.form.backgroundColor", "Background Color")}
                          </Text>
                          <div style={{ marginTop: "4px" }}>
                            <input
                              type="color"
                              value={buttonBgColor}
                              onChange={(e) => setButtonBgColor(e.target.value)}
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
                            {t("Advertisement.form.textColor", "Text Color")}
                          </Text>
                          <div style={{ marginTop: "4px" }}>
                            <input
                              type="color"
                              value={buttonTextColor}
                              onChange={(e) => setButtonTextColor(e.target.value)}
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
                          label={t("Advertisement.form.textSize", "Text Size")}
                          options={TEXT_SIZES}
                          value={buttonTextSize}
                          onChange={setButtonTextSize}
                        />
                        <Select
                          label={t("Advertisement.form.placement", "Placement")}
                          options={BUTTON_PLACEMENTS}
                          value={buttonPlacement}
                          onChange={setButtonPlacement}
                        />
                      </FormLayout.Group>
                    </FormLayout>
                  </>
                )}
              </div>
            </LegacyStack>
          </LegacyCard>
        </Layout.Section>

        {/* Scheduling */}
        <Layout.Section>
          <LegacyCard sectioned>
            <LegacyStack vertical spacing="loose">
              <Text variant="headingMd" as="h2">
                {t("Advertisement.form.scheduling", "Scheduling")}
              </Text>

              <Checkbox
                label={t("Advertisement.form.scheduleAd", "Schedule this advertisement")}
                checked={schedulingEnabled}
                onChange={setSchedulingEnabled}
              />

              {schedulingEnabled && (
                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label={t("Advertisement.form.startDate", "Start Date")}
                      type="datetime-local"
                      value={startDate}
                      onChange={setStartDate}
                      helpText="All times are in UTC"
                    />
                    <TextField
                      label={t("Advertisement.form.endDate", "End Date")}
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

        {/* Footer Buttons */}
        <Layout.Section>
          <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "20px" }}>
            <Button onClick={() => navigate("/")}>
              {t("Advertisement.form.cancel", "Cancel")}
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {t("Advertisement.form.save", "Save Advertisement")}
            </Button>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
