import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "react-query";
import {
  Page,
  Layout,
  LegacyCard,
  FormLayout,
  TextField,
  Checkbox,
  Select,
  Button,
  Banner,
  Spinner,
  LegacyStack,
  Text,
  Tabs,
  Icon,
  ButtonGroup,
  Divider,
  Collapsible,
  ChoiceList,
} from "@shopify/polaris";
import { DeleteIcon, PlusIcon } from "@shopify/polaris-icons";
import { useAuthenticatedFetch } from "../../hooks/useAuthenticatedFetch";

const FONT_SIZES = [
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
];

const HTML_TAGS = [
  { label: "<p> Paragraph", value: "p" },
  { label: "<h1> Heading 1", value: "h1" },
  { label: "<h2> Heading 2", value: "h2" },
  { label: "<h3> Heading 3", value: "h3" },
  { label: "<h4> Heading 4", value: "h4" },
  { label: "<span> Span", value: "span" },
  { label: "<div> Div", value: "div" },
];

const LINK_TYPES = [
  { label: "Select link type", value: "" },
  { label: "External URL", value: "external" },
  { label: "Product Type", value: "productType" },
  { label: "Collection", value: "collection" },
  { label: "Homepage", value: "homepage" },
];

const LINK_TARGETS = [
  { label: "Same Window", value: "_self" },
  { label: "New Window", value: "_blank" },
];

export default function CreateAnnouncementBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authenticatedFetch = useAuthenticatedFetch();

  // Form state
  const [name, setName] = useState("");
  const [status, setStatus] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState("#000000");

  // Content lines state
  const [contentLines, setContentLines] = useState([
    {
      id: 1,
      activeTab: 0,
      desktop: { text: "", fontSize: "14px", htmlTag: "p" },
      mobile: { text: "", fontSize: "14px", htmlTag: "p" },
    },
  ]);

  // Scheduling state
  const [schedulingEnabled, setSchedulingEnabled] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Link state
  const [linkEnabled, setLinkEnabled] = useState(false);
  const [linkType, setLinkType] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const [linkTarget, setLinkTarget] = useState("_self");

  // Coupon state
  const [couponEnabled, setCouponEnabled] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDisplay, setCouponDisplay] = useState({
    text: "",
    fontSize: "14px",
    htmlTag: "p",
  });

  // Assignment state
  const [assignment, setAssignment] = useState({
    homepage: false,
    productTypes: [],
    collections: [],
  });

  // UI state
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Fetch discounts
  const { data: discountsData } = useQuery({
    queryKey: ["discounts"],
    queryFn: async () => {
      const response = await authenticatedFetch("/api/discounts");
      if (!response.ok) return { discounts: [] };
      return await response.json();
    },
    refetchOnWindowFocus: false,
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

  const discounts = discountsData?.discounts || [];
  const collections = collectionsData?.collections || [];
  const productTypes = productTypesData?.productTypes || [];

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const response = await authenticatedFetch("/api/announcement-bars", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save");
      }
      return await response.json();
    },
    onSuccess: () => {
      navigate("/");
    },
    onError: (err) => {
      setError(err.message);
      setSaving(false);
    },
  });

  // Content line handlers
  const addContentLine = useCallback(() => {
    const newId = Math.max(...contentLines.map((l) => l.id), 0) + 1;
    setContentLines([
      ...contentLines,
      {
        id: newId,
        activeTab: 0,
        desktop: { text: "", fontSize: "14px", htmlTag: "p" },
        mobile: { text: "", fontSize: "14px", htmlTag: "p" },
      },
    ]);
  }, [contentLines]);

  const removeContentLine = useCallback(
    (id) => {
      if (contentLines.length > 1) {
        setContentLines(contentLines.filter((line) => line.id !== id));
      }
    },
    [contentLines]
  );

  const updateContentLine = useCallback(
    (id, device, field, value) => {
      setContentLines(
        contentLines.map((line) => {
          if (line.id === id) {
            return {
              ...line,
              [device]: {
                ...line[device],
                [field]: value,
              },
            };
          }
          return line;
        })
      );
    },
    [contentLines]
  );

  const setContentLineTab = useCallback(
    (id, tabIndex) => {
      setContentLines(
        contentLines.map((line) => {
          if (line.id === id) {
            return { ...line, activeTab: tabIndex };
          }
          return line;
        })
      );
    },
    [contentLines]
  );

  // Assignment handlers
  const handleAssignmentChange = useCallback(
    (key, value) => {
      setAssignment({ ...assignment, [key]: value });
    },
    [assignment]
  );

  // Form validation and submission
  const handleSave = useCallback(() => {
    if (!name.trim()) {
      setError("Please enter a name for the announcement bar");
      return;
    }

    setSaving(true);
    setError(null);

    const data = {
      name: name.trim(),
      status,
      backgroundColor,
      content: contentLines.map((line) => ({
        desktop: line.desktop,
        mobile: line.mobile,
      })),
      schedulingEnabled,
      startDate: schedulingEnabled && startDate ? new Date(startDate).toISOString() : null,
      endDate: schedulingEnabled && endDate ? new Date(endDate).toISOString() : null,
      linkEnabled,
      linkType: linkEnabled ? linkType : null,
      linkValue: linkEnabled ? linkValue : null,
      linkTarget: linkEnabled ? linkTarget : "_self",
      couponEnabled,
      couponCode: couponEnabled ? couponCode : null,
      couponDisplay: couponEnabled ? couponDisplay : null,
      assignment,
    };

    saveMutation.mutate(data);
  }, [
    name,
    status,
    backgroundColor,
    contentLines,
    schedulingEnabled,
    startDate,
    endDate,
    linkEnabled,
    linkType,
    linkValue,
    linkTarget,
    couponEnabled,
    couponCode,
    couponDisplay,
    assignment,
    saveMutation,
  ]);

  // Render content line
  const renderContentLine = (line, index) => {
    const tabs = [
      {
        id: `desktop-${line.id}`,
        content: t("AnnouncementBar.form.desktop"),
        panelID: `desktop-panel-${line.id}`,
      },
      {
        id: `mobile-${line.id}`,
        content: t("AnnouncementBar.form.mobile"),
        panelID: `mobile-panel-${line.id}`,
      },
    ];

    const device = line.activeTab === 0 ? "desktop" : "mobile";

    return (
      <LegacyCard key={line.id} sectioned>
        <LegacyStack vertical spacing="loose">
          <LegacyStack distribution="equalSpacing">
            <Text variant="headingSm" as="h3">
              Line {index + 1}
            </Text>
            {contentLines.length > 1 && (
              <Button
                icon={DeleteIcon}
                variant="plain"
                tone="critical"
                onClick={() => removeContentLine(line.id)}
              />
            )}
          </LegacyStack>

          <Tabs
            tabs={tabs}
            selected={line.activeTab}
            onSelect={(tabIndex) => setContentLineTab(line.id, tabIndex)}
          />

          <FormLayout>
            <FormLayout.Group>
              <Select
                label={t("AnnouncementBar.form.fontSize")}
                options={FONT_SIZES}
                value={line[device].fontSize}
                onChange={(value) => updateContentLine(line.id, device, "fontSize", value)}
              />
              <Select
                label={t("AnnouncementBar.form.htmlTag")}
                options={HTML_TAGS}
                value={line[device].htmlTag}
                onChange={(value) => updateContentLine(line.id, device, "htmlTag", value)}
              />
            </FormLayout.Group>

            <TextField
              label="Content"
              value={line[device].text}
              onChange={(value) => updateContentLine(line.id, device, "text", value)}
              multiline={3}
              placeholder={`Enter ${device} announcement text...`}
              helpText="You can use basic HTML tags for formatting (bold, italic, links)"
            />
          </FormLayout>
        </LegacyStack>
      </LegacyCard>
    );
  };

  return (
    <Page
      title={t("AnnouncementBar.create.title")}
      subtitle={t("AnnouncementBar.create.subtitle")}
      backAction={{ content: "Back", onAction: () => navigate("/") }}
      primaryAction={{
        content: t("AnnouncementBar.form.save"),
        onAction: handleSave,
        loading: saving,
      }}
      secondaryActions={[
        {
          content: t("AnnouncementBar.form.cancel"),
          onAction: () => navigate("/"),
        },
      ]}
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
          <LegacyCard title={t("AnnouncementBar.form.basicInfo")} sectioned>
            <FormLayout>
              <TextField
                label={t("AnnouncementBar.form.name")}
                value={name}
                onChange={setName}
                placeholder={t("AnnouncementBar.form.namePlaceholder")}
                requiredIndicator
              />

              <Checkbox
                label={t("AnnouncementBar.form.statusEnabled")}
                checked={status}
                onChange={setStatus}
              />

              <div>
                <Text variant="bodyMd" as="p" fontWeight="medium">
                  {t("AnnouncementBar.form.backgroundColor")}
                </Text>
                <div style={{ marginTop: "8px" }}>
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    style={{
                      width: "100px",
                      height: "40px",
                      border: "1px solid #c9cccf",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  />
                </div>
              </div>
            </FormLayout>
          </LegacyCard>
        </Layout.Section>

        {/* Content */}
        <Layout.Section>
          <LegacyCard title={t("AnnouncementBar.form.content")}>
            <LegacyCard.Section>
              <LegacyStack vertical spacing="loose">
                {contentLines.map((line, index) => renderContentLine(line, index))}

                <Button icon={PlusIcon} onClick={addContentLine}>
                  {t("AnnouncementBar.form.addLine")}
                </Button>
              </LegacyStack>
            </LegacyCard.Section>
          </LegacyCard>
        </Layout.Section>

        {/* Scheduling */}
        <Layout.Section>
          <LegacyCard title={t("AnnouncementBar.form.scheduling")} sectioned>
            <FormLayout>
              <Checkbox
                label={t("AnnouncementBar.form.enableScheduling")}
                checked={schedulingEnabled}
                onChange={setSchedulingEnabled}
              />

              {schedulingEnabled && (
                <>
                  <TextField
                    label={t("AnnouncementBar.form.startDate")}
                    type="datetime-local"
                    value={startDate}
                    onChange={setStartDate}
                    helpText="All times are in UTC"
                  />
                  <TextField
                    label={t("AnnouncementBar.form.endDate")}
                    type="datetime-local"
                    value={endDate}
                    onChange={setEndDate}
                    helpText="All times are in UTC"
                  />
                </>
              )}
            </FormLayout>
          </LegacyCard>
        </Layout.Section>

        {/* Link / Call to Action */}
        <Layout.Section>
          <LegacyCard title={t("AnnouncementBar.form.link")} sectioned>
            <FormLayout>
              <Checkbox
                label={t("AnnouncementBar.form.addLink")}
                checked={linkEnabled}
                onChange={setLinkEnabled}
              />

              {linkEnabled && (
                <>
                  <Select
                    label={t("AnnouncementBar.form.linkType")}
                    options={LINK_TYPES}
                    value={linkType}
                    onChange={setLinkType}
                  />

                  {linkType === "external" && (
                    <TextField
                      label={t("AnnouncementBar.form.linkValue")}
                      type="url"
                      value={linkValue}
                      onChange={setLinkValue}
                      placeholder="https://example.com"
                    />
                  )}

                  {linkType === "productType" && (
                    <Select
                      label="Select Product Type"
                      options={[
                        { label: "Choose a product type", value: "" },
                        ...productTypes.map((type) => ({
                          label: type,
                          value: type,
                        })),
                      ]}
                      value={linkValue}
                      onChange={setLinkValue}
                    />
                  )}

                  {linkType === "collection" && (
                    <Select
                      label="Select Collection"
                      options={[
                        { label: "Choose a collection", value: "" },
                        ...collections.map((col) => ({
                          label: col.title,
                          value: col.handle,
                        })),
                      ]}
                      value={linkValue}
                      onChange={setLinkValue}
                    />
                  )}

                  {linkType && linkType !== "homepage" && (
                    <Select
                      label={t("AnnouncementBar.form.linkTarget")}
                      options={LINK_TARGETS}
                      value={linkTarget}
                      onChange={setLinkTarget}
                    />
                  )}
                </>
              )}
            </FormLayout>
          </LegacyCard>
        </Layout.Section>

        {/* Coupon Code Integration */}
        <Layout.Section>
          <LegacyCard title={t("AnnouncementBar.form.coupon")} sectioned>
            <FormLayout>
              <Checkbox
                label={t("AnnouncementBar.form.addCoupon")}
                checked={couponEnabled}
                onChange={setCouponEnabled}
              />

              {couponEnabled && (
                <>
                  <Select
                    label={t("AnnouncementBar.form.selectCoupon")}
                    options={[
                      { label: "Choose a coupon", value: "" },
                      ...discounts.map((discount) => ({
                        label: `${discount.code} - ${discount.summary}`,
                        value: discount.code,
                      })),
                    ]}
                    value={couponCode}
                    onChange={setCouponCode}
                  />

                  {couponCode && (
                    <>
                      <TextField
                        label={t("AnnouncementBar.form.couponDisplay")}
                        value={couponDisplay.text}
                        onChange={(value) =>
                          setCouponDisplay({ ...couponDisplay, text: value })
                        }
                        multiline={2}
                        placeholder={`Use code ${couponCode} for a discount!`}
                        helpText="This text will be displayed as an additional line"
                      />
                      <FormLayout.Group>
                        <Select
                          label={t("AnnouncementBar.form.fontSize")}
                          options={FONT_SIZES}
                          value={couponDisplay.fontSize}
                          onChange={(value) =>
                            setCouponDisplay({ ...couponDisplay, fontSize: value })
                          }
                        />
                        <Select
                          label={t("AnnouncementBar.form.htmlTag")}
                          options={HTML_TAGS}
                          value={couponDisplay.htmlTag}
                          onChange={(value) =>
                            setCouponDisplay({ ...couponDisplay, htmlTag: value })
                          }
                        />
                      </FormLayout.Group>
                    </>
                  )}
                </>
              )}
            </FormLayout>
          </LegacyCard>
        </Layout.Section>

        {/* Assignment */}
        <Layout.Section>
          <LegacyCard title={t("AnnouncementBar.form.assignment")} sectioned>
            <LegacyStack vertical spacing="loose">
              <Text variant="bodyMd" as="p" tone="subdued">
                {t("AnnouncementBar.form.assignmentDescription")}
              </Text>

              <Checkbox
                label={t("AnnouncementBar.form.homepage")}
                checked={assignment.homepage}
                onChange={(value) => handleAssignmentChange("homepage", value)}
              />

              <div>
                <Checkbox
                  label={t("AnnouncementBar.form.productTypes")}
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
                  label={t("AnnouncementBar.form.collections")}
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
                        value: col.id,
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
      </Layout>
    </Page>
  );
}
