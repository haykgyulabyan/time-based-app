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
} from "@shopify/polaris";
import { MenuVerticalIcon } from "@shopify/polaris-icons";
import { useAuthenticatedFetch } from "../hooks/useAuthenticatedFetch";

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authenticatedFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const [activePopover, setActivePopover] = useState(null);
  const [error, setError] = useState(null);

  // Fetch announcement bars
  const { data, isLoading, isError } = useQuery({
    queryKey: ["announcementBars"],
    queryFn: async () => {
      const response = await authenticatedFetch("/api/announcement-bars");
      if (!response.ok) throw new Error("Failed to fetch announcement bars");
      return await response.json();
    },
    refetchOnWindowFocus: false,
  });

  // Delete mutation
  const deleteMutation = useMutation({
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

  // Duplicate mutation
  const duplicateMutation = useMutation({
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

  const announcementBars = data?.announcementBars || [];

  const getStatusBadge = (bar) => {
    if (!bar.status) {
      return <Badge tone="info">{t("Dashboard.status.inactive")}</Badge>;
    }
    if (bar.schedulingEnabled) {
      const now = new Date();
      const start = bar.startDate ? new Date(bar.startDate) : null;
      const end = bar.endDate ? new Date(bar.endDate) : null;

      if (start && now < start) {
        return <Badge tone="attention">{t("Dashboard.status.scheduled")}</Badge>;
      }
      if (end && now > end) {
        return <Badge tone="info">{t("Dashboard.status.inactive")}</Badge>;
      }
    }
    return <Badge tone="success">{t("Dashboard.status.active")}</Badge>;
  };

  const getScheduleText = (bar) => {
    if (!bar.schedulingEnabled) return "Always";
    const start = bar.startDate ? new Date(bar.startDate).toLocaleDateString() : "Now";
    const end = bar.endDate ? new Date(bar.endDate).toLocaleDateString() : "Forever";
    return `${start} - ${end}`;
  };

  const rows = announcementBars.map((bar) => [
    bar.name,
    getStatusBadge(bar),
    getScheduleText(bar),
    <Popover
      key={bar.id}
      active={activePopover === bar.id}
      activator={
        <Button
          icon={MenuVerticalIcon}
          variant="plain"
          onClick={() => setActivePopover(activePopover === bar.id ? null : bar.id)}
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
              duplicateMutation.mutate(bar.id);
            },
          },
          {
            content: t("Dashboard.actions.delete"),
            destructive: true,
            onAction: () => {
              setActivePopover(null);
              if (confirm("Are you sure you want to delete this announcement bar?")) {
                deleteMutation.mutate(bar.id);
              }
            },
          },
        ]}
      />
    </Popover>,
  ]);

  if (isLoading) {
    return (
      <Page>
        <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
          <Spinner size="large" />
        </div>
      </Page>
    );
  }

  return (
    <Page
      title={t("Dashboard.title")}
      subtitle={t("Dashboard.subtitle")}
      primaryAction={{
        content: t("Dashboard.createButton"),
        onAction: () => navigate("/announcement-bars/new"),
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
          {announcementBars.length === 0 ? (
            <LegacyCard sectioned>
              <EmptyState
                heading={t("Dashboard.emptyState.heading")}
                action={{
                  content: t("Dashboard.createButton"),
                  onAction: () => navigate("/announcement-bars/new"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>{t("Dashboard.emptyState.content")}</p>
              </EmptyState>
            </LegacyCard>
          ) : (
            <LegacyCard>
              <DataTable
                columnContentTypes={["text", "text", "text", "text"]}
                headings={[
                  t("Dashboard.table.name"),
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
  );
}
