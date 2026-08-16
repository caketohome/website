// Shims for react-aria legacy default export paths used by @medusajs/ui
import { I18nProvider } from "@react-aria/i18n";
import { useBreadcrumbs, useButton, useToggleButton } from "react-aria";

export { I18nProvider, useBreadcrumbs, useButton, useToggleButton };
export default { I18nProvider, useBreadcrumbs, useButton, useToggleButton };
