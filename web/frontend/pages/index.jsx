import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "react-query";
import {
  Page,
  Layout,
  LegacyCard,
  DataTable,
  Button,
  Badge,
  Popover,
  ActionList,
  EmptyState,
  Spinner,
  Banner,
  Modal,
  Text,
} from "@shopify/polaris";
import { MenuVerticalIcon } from "@shopify/polaris-icons";
import { useAuthenticatedFetch } from "../hooks/useAuthenticatedFetch";

// Content type card component for the modal
function ContentTypeCard({ icon, iconBg, title, description, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: "1",
        padding: "20px",
        backgroundColor: "#f9fafb",
        borderRadius: "12px",
        cursor: "pointer",
        textAlign: "center",
        transition: "all 0.2s ease",
        border: "1px solid transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#f3f4f6";
        e.currentTarget.style.border = "1px solid #e5e7eb";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "#f9fafb";
        e.currentTarget.style.border = "1px solid transparent";
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          backgroundColor: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 12px",
          fontSize: "24px",
        }}
      >
        {icon}
      </div>
      <Text variant="bodyMd" fontWeight="semibold" as="p">
        {title}
      </Text>
      <Text variant="bodySm" tone="subdued" as="p">
        {description}
      </Text>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authenticatedFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const [activePopover, setActivePopover] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch announcement bars
  const { data: announcementData, isLoading: loadingAnnouncements } = useQuery({
    queryKey: ["announcementBars"],
    queryFn: async () => {
      const response = await authenticatedFetch("/api/announcement-bars");
      if (!response.ok) return { announcementBars: [] };
      return await response.json();
    },
    refetchOnWindowFocus: false,
  });

  // Fetch slider banners
  const { data: sliderData, isLoading: loadingSliders } = useQuery({
    queryKey: ["sliderBanners"],
    queryFn: async () => {
      const response = await authenticatedFetch("/api/slider-banners");
      if (!response.ok) return { sliderBanners: [] };
      return await response.json();
    },
    refetchOnWindowFocus: false,
  });

  // Delete announcement mutation
  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id) => {
      const response = await authenticatedFetch(`/api/announcement-bars/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["announcementBars"]);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Duplicate announcement mutation
  const duplicateAnnouncementMutation = useMutation({
    mutationFn: async (id) => {
      const response = await authenticatedFetch(`/api/announcement-bars/${id}/duplicate`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to duplicate");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["announcementBars"]);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Delete slider mutation
  const deleteSliderMutation = useMutation({
    mutationFn: async (id) => {
      const response = await authenticatedFetch(`/api/slider-banners/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["sliderBanners"]);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Duplicate slider mutation
  const duplicateSliderMutation = useMutation({
    mutationFn: async (id) => {
      const response = await authenticatedFetch(`/api/slider-banners/${id}/duplicate`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to duplicate");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["sliderBanners"]);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const announcementBars = announcementData?.announcementBars || [];
  const sliderBanners = sliderData?.sliderBanners || [];
  const isLoading = loadingAnnouncements || loadingSliders;

  const getStatusBadge = (item) => {
    if (!item.status) {
      return <Badge tone="info">{t("Dashboard.status.inactive")}</Badge>;
    }
    if (item.schedulingEnabled) {
      const now = new Date();
      const start = item.startDate ? new Date(item.startDate) : null;
      const end = item.endDate ? new Date(item.endDate) : null;

      if (start && now < start) {
        return <Badge tone="attention">{t("Dashboard.status.scheduled")}</Badge>;
      }
      if (end && now > end) {
        return <Badge tone="info">{t("Dashboard.status.inactive")}</Badge>;
      }
    }
    return <Badge tone="success">{t("Dashboard.status.active")}</Badge>;
  };

  const getScheduleText = (item) => {
    if (!item.schedulingEnabled) return "Always";
    const start = item.startDate ? new Date(item.startDate).toLocaleDateString() : "Now";
    const end = item.endDate ? new Date(item.endDate).toLocaleDateString() : "Forever";
    return `${start} - ${end}`;
  };

  const handleContentTypeSelect = (type) => {
    setModalOpen(false);
    switch (type) {
      case "announcement-bar":
        navigate("/announcement-bars/new");
        break;
      case "slider-banner":
        navigate("/slider-banners/new");
        break;
      case "advertisement":
        // TODO: Implement advertisement creation
        navigate("/advertisements/new");
        break;
      default:
        break;
    }
  };

  // Build rows from both announcement bars and slider banners
  const announcementRows = announcementBars.map((bar) => [
    bar.name,
    <Badge key={`type-${bar.id}`}>Announcement Bar</Badge>,
    getStatusBadge(bar),
    getScheduleText(bar),
    <Popover
      key={`popover-ann-${bar.id}`}
      active={activePopover === `ann-${bar.id}`}
      activator={
        <Button
          icon={MenuVerticalIcon}
          variant="plain"
          onClick={() => setActivePopover(activePopover === `ann-${bar.id}` ? null : `ann-${bar.id}`)}
        />
      }
      onClose={() => setActivePopover(null)}
    >
      <ActionList
        items={[
          {
            content: t("Dashboard.actions.edit"),
            onAction: () => {
              setActivePopover(null);
              navigate(`/announcement-bars/${bar.id}`);
            },
          },
          {
            content: t("Dashboard.actions.duplicate"),
            onAction: () => {
              setActivePopover(null);
              duplicateAnnouncementMutation.mutate(bar.id);
            },
          },
          {
            content: t("Dashboard.actions.delete"),
            destructive: true,
            onAction: () => {
              setActivePopover(null);
              if (confirm("Are you sure you want to delete this announcement bar?")) {
                deleteAnnouncementMutation.mutate(bar.id);
              }
            },
          },
        ]}
      />
    </Popover>,
  ]);

  const sliderRows = sliderBanners.map((banner) => [
    banner.name,
    <Badge key={`type-slider-${banner.id}`} tone="info">Slider Banner</Badge>,
    getStatusBadge(banner),
    getScheduleText(banner),
    <Popover
      key={`popover-slider-${banner.id}`}
      active={activePopover === `slider-${banner.id}`}
      activator={
        <Button
          icon={MenuVerticalIcon}
          variant="plain"
          onClick={() => setActivePopover(activePopover === `slider-${banner.id}` ? null : `slider-${banner.id}`)}
        />
      }
      onClose={() => setActivePopover(null)}
    >
      <ActionList
        items={[
          {
            content: t("Dashboard.actions.edit"),
            onAction: () => {
              setActivePopover(null);
              navigate(`/slider-banners/${banner.id}`);
            },
          },
          {
            content: t("Dashboard.actions.duplicate"),
            onAction: () => {
              setActivePopover(null);
              duplicateSliderMutation.mutate(banner.id);
            },
          },
          {
            content: t("Dashboard.actions.delete"),
            destructive: true,
            onAction: () => {
              setActivePopover(null);
              if (confirm("Are you sure you want to delete this slider banner?")) {
                deleteSliderMutation.mutate(banner.id);
              }
            },
          },
        ]}
      />
    </Popover>,
  ]);

  const rows = [...announcementRows, ...sliderRows];

  if (isLoading) {
    return (
      <Page>
        <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
          <Spinner size="large" />
        </div>
      </Page>
    );
  }

  const hasContent = rows.length > 0;

  return (
    <>
      <Page
        title={t("Dashboard.title")}
        subtitle={t("Dashboard.subtitle")}
        primaryAction={{
          content: t("Dashboard.createButton"),
          onAction: () => setModalOpen(true),
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

          <Layout.Section>
            {!hasContent ? (
              <LegacyCard sectioned>
                <EmptyState
                  heading={t("Dashboard.emptyState.heading")}
                  action={{
                    content: t("Dashboard.createContent"),
                    onAction: () => setModalOpen(true),
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>{t("Dashboard.emptyState.content")}</p>
                </EmptyState>
              </LegacyCard>
            ) : (
              <LegacyCard>
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text"]}
                  headings={[
                    t("Dashboard.table.name"),
                    t("Dashboard.table.type"),
                    t("Dashboard.table.status"),
                    t("Dashboard.table.schedule"),
                    t("Dashboard.table.actions"),
                  ]}
                  rows={rows}
                />
              </LegacyCard>
            )}
          </Layout.Section>
        </Layout>
      </Page>

      {/* Create Content Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("CreateContentModal.title")}
      >
        <Modal.Section>
          <div style={{ display: "flex", gap: "16px" }}>
            <ContentTypeCard
              icon="📢"
              iconBg="#8b5cf6"
              title={t("Dashboard.contentTypes.announcementBar")}
              description={t("Dashboard.contentTypes.announcementBarDescription")}
              onClick={() => handleContentTypeSelect("announcement-bar")}
            />
            <ContentTypeCard
              icon="🖼️"
              iconBg="#3b82f6"
              title={t("Dashboard.contentTypes.sliderBanner")}
              description={t("Dashboard.contentTypes.sliderBannerDescription")}
              onClick={() => handleContentTypeSelect("slider-banner")}
            />
            <ContentTypeCard
              icon="📋"
              iconBg="#f59e0b"
              title={t("Dashboard.contentTypes.advertisement")}
              description={t("Dashboard.contentTypes.advertisementDescription")}
              onClick={() => handleContentTypeSelect("advertisement")}
            />
          </div>
        </Modal.Section>
      </Modal>
    </>
  );
}
