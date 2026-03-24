# Re-integrate i18n Across All Dashboard Modules

The user restructured all locale JSON files with a simplified, flat key structure and removed the [useTranslation](file:///e:/Do%20an/webapp_anti/frontend/src/i18n/provider.tsx#43-46) hook from all components. This plan re-integrates translations using [useTranslation](file:///e:/Do%20an/webapp_anti/frontend/src/i18n/provider.tsx#43-46) + [t()](file:///e:/Do%20an/webapp_anti/frontend/src/i18n/provider.tsx#15-16) in client components and `T` in server components.

## Proposed Changes

### Client Components (add [useTranslation](file:///e:/Do%20an/webapp_anti/frontend/src/i18n/provider.tsx#43-46) + [t()](file:///e:/Do%20an/webapp_anti/frontend/src/i18n/provider.tsx#15-16))

---

#### [MODIFY] [upload-form.tsx](file:///e:/Do%20an/webapp_anti/frontend/src/app/dashboard/inference/components/upload-form.tsx)

**~30 hardcoded strings** → Map to `inference.*` keys:
- Labels: `inference.select_greenhouse`, `inference.capture_time`, `inference.temperature`, `inference.humidity`
- Dropzone: `inference.drop_images`
- Buttons: `inference.upload_infer`, `inference.uploading`
- Status overlays: `inference.uploading`, hardcoded "Inferencing..." (no key needed—keep as English or add)

> [!NOTE]
> Strings with dynamic interpolation like `Processing image 1 of 5` cannot use simple [t()](file:///e:/Do%20an/webapp_anti/frontend/src/i18n/provider.tsx#15-16) since the user removed interpolation. These will be kept as template literals.

---

#### [MODIFY] [recent-uploads-table.tsx](file:///e:/Do%20an/webapp_anti/frontend/src/app/dashboard/inference/components/recent-uploads-table.tsx)

**~20 hardcoded strings** → Map to `inference.*` keys:
- Table headers: `inference.image`, `inference.greenhouse`, `inference.capture_date`, `inference.status`, `inference.actions`
- Tooltips: `inference.view_details`, `inference.delete_image`
- Modal: `inference.details`, `inference.name`, `inference.greenhouse`, `inference.captured`, `inference.temperature`, `inference.humidity`
- Pagination text: `inference.showing`, `inference.of`, `inference.images`

---

#### [MODIFY] [greenhouse-list.tsx](file:///e:/Do%20an/webapp_anti/frontend/src/app/dashboard/greenhouses/components/greenhouse-list.tsx)

**~8 hardcoded strings** → Map to `greenhouse.*` keys:
- Title/subtitle: `greenhouse.title` + new `greenhouse.no_greenhouses`
- Buttons: `greenhouse.create`, `greenhouse.edit`, `greenhouse.delete`
- Confirm: `greenhouse.confirm_delete`

---

#### [MODIFY] [greenhouse-form.tsx](file:///e:/Do%20an/webapp_anti/frontend/src/app/dashboard/greenhouses/components/greenhouse-form.tsx)

**~15 hardcoded strings** → Map to `greenhouse.*` keys:
- Labels: `greenhouse.name`, `greenhouse.code`, `greenhouse.location`, `greenhouse.crop_type`, `greenhouse.area`, `greenhouse.description`
- Buttons: `greenhouse.cancel`, `greenhouse.save`, `greenhouse.create`, `greenhouse.edit`

---

#### [MODIFY] [pest-breakdown.tsx](file:///e:/Do%20an/webapp_anti/frontend/src/app/dashboard/greenhouses/%5Bid%5D/components/pest-breakdown.tsx)

**~8 hardcoded strings** → Map to `greenhouse.*` keys:
- Title: `greenhouse.pest_breakdown`
- Buttons: `greenhouse.save_thresholds`, `greenhouse.saving`
- Labels: `greenhouse.alert_threshold`, `greenhouse.set_limit`
- Messages: `greenhouse.saved_success`, `greenhouse.save_failed`

---

#### [MODIFY] [greenhouse-image-grid.tsx](file:///e:/Do%20an/webapp_anti/frontend/src/app/dashboard/greenhouses/%5Bid%5D/components/greenhouse-image-grid.tsx)

**~5 hardcoded strings** → Map to `greenhouse.*` / `inference.*` keys:
- `greenhouse.view_detections`, pagination with `inference.showing`/`inference.of`/`inference.images`

---

#### [MODIFY] [image-viewer.tsx](file:///e:/Do%20an/webapp_anti/frontend/src/app/dashboard/inference/components/image-viewer.tsx)

**~10 hardcoded strings** → Map to `inference.*` keys:
- Labels: `inference.details`, `inference.greenhouse`, `inference.captured`, `inference.status`, `inference.temperature`, `inference.humidity`

---

### Server Component (use `T` component)

#### [MODIFY] [settings/page.tsx](file:///e:/Do%20an/webapp_anti/frontend/src/app/dashboard/settings/page.tsx)

> [!IMPORTANT]
> Settings/Profile page is a **server component** — cannot use [useTranslation](file:///e:/Do%20an/webapp_anti/frontend/src/i18n/provider.tsx#43-46). Need to either:
> 1. Convert to client component, or
> 2. Add keys to en.json and use the `T` component for translatable text, keeping form field values in English.
>
> I'll use approach #2 (`T` component), which requires adding `settings.*` keys to en.json.

**~10 hardcoded strings** → Need new `settings.*` locale keys in all 6 JSON files.

---

### Locale Files

#### [MODIFY] All locale JSON files (en, vi, zh, ja, ko, th)

Add missing `settings.*` section for the settings page.

## Verification Plan

### Automated
- Run `npm run build` to confirm no TypeScript/import errors.

### Manual
- Switch languages in the UI and verify all labels change.
