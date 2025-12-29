import { useTranslation } from "react-i18next";
import { Page, LegacyCard, EmptyState } from "@shopify/polaris";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <Page>
      <LegacyCard sectioned>
        <EmptyState
          heading={t("NotFound.heading")}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>{t("NotFound.description")}</p>
        </EmptyState>
      </LegacyCard>
    </Page>
  );
}
