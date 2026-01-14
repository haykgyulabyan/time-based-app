import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Redirect } from "@shopify/app-bridge/actions";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function ExitIframe() {
  const app = useAppBridge();
  const { search } = useLocation();

  useEffect(() => {
    if (app && search) {
      const params = new URLSearchParams(search);
      const redirectUri = params.get("redirectUri");

      if (redirectUri) {
        const redirect = Redirect.create(app);
        redirect.dispatch(Redirect.Action.REMOTE, decodeURIComponent(redirectUri));
      }
    }
  }, [app, search]);

  return null;
}
