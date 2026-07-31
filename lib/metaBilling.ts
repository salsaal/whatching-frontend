export const buildMetaPaymentMethodUrl = ({
  businessId,
  wabaId
}: {
  businessId?: string | null;
  wabaId?: string | null;
}) => {
  if (!businessId?.trim() || !wabaId?.trim()) return null;

  const url = new URL("https://business.facebook.com/wa/manage/home");
  url.searchParams.set("business_id", businessId.trim());
  url.searchParams.set("waba_id", wabaId.trim());
  return url.toString();
};
