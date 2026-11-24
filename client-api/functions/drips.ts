import api from "../axiosInstance";
import { DRIP_ENDPOINTS } from "../endpoints";
import { ApiResponse } from "../types/api";
import {
  ContactDripRow,
  Drip,
  DripAudience,
  DripAudiencePreview,
  DripContactsPage,
  DripContactsParams,
  DripPayload,
  DripReport,
  DripStatus,
  StartDripPayload
} from "../types/drips.type";

type DripResponse = ApiResponse<{ drip: Drip }>;

const dataOf = <T>(response: ApiResponse<T>) => response.data as T;

export const listDrips = async (status?: DripStatus) => {
  const res = await api.get<ApiResponse<{ drips: Drip[] }>>(
    DRIP_ENDPOINTS.LIST,
    { params: status ? { status } : {} }
  );
  return dataOf(res.data).drips;
};

export const getDrip = async (dripId: string) => {
  const res = await api.get<DripResponse>(DRIP_ENDPOINTS.BY_ID(dripId));
  return dataOf(res.data).drip;
};

export const createDrip = async (payload: DripPayload) => {
  const res = await api.post<DripResponse>(DRIP_ENDPOINTS.CREATE, {
    steps: [],
    ...payload
  });
  return dataOf(res.data).drip;
};

export const updateDrip = async ({
  dripId,
  payload
}: {
  dripId: string;
  payload: DripPayload;
}) => {
  const res = await api.patch<DripResponse>(
    DRIP_ENDPOINTS.BY_ID(dripId),
    payload
  );
  return dataOf(res.data).drip;
};

export const deleteDrip = async (dripId: string) => {
  await api.delete(DRIP_ENDPOINTS.BY_ID(dripId));
};

export const previewDripAudience = async ({
  dripId,
  audience
}: {
  dripId: string;
  audience: DripAudience;
}) => {
  const res = await api.post<ApiResponse<{ preview: DripAudiencePreview }>>(
    DRIP_ENDPOINTS.AUDIENCE_PREVIEW(dripId),
    { audience }
  );
  return dataOf(res.data).preview;
};

export const startDrip = async ({
  dripId,
  payload
}: {
  dripId: string;
  payload: StartDripPayload;
}) => {
  const res = await api.post<ApiResponse<{ drip: Drip; startAt: string }>>(
    DRIP_ENDPOINTS.START(dripId),
    payload
  );
  return dataOf(res.data);
};

export const addDripContacts = async ({
  dripId,
  audience
}: {
  dripId: string;
  audience: DripAudience;
}) => {
  const res = await api.post<DripResponse>(DRIP_ENDPOINTS.CONTACTS(dripId), {
    audience
  });
  return dataOf(res.data).drip;
};

export const listDripContacts = async (
  dripId: string,
  params: DripContactsParams
) => {
  const res = await api.get<ApiResponse<DripContactsPage>>(
    DRIP_ENDPOINTS.CONTACTS(dripId),
    { params }
  );
  return dataOf(res.data);
};

export const removeDripContact = async ({
  dripId,
  contactRowId
}: {
  dripId: string;
  contactRowId: string;
}) => {
  await api.delete(DRIP_ENDPOINTS.CONTACT(dripId, contactRowId));
};

const dripAction =
  (endpoint: (dripId: string) => string) => async (dripId: string) => {
    const res = await api.post<DripResponse>(endpoint(dripId));
    return dataOf(res.data).drip;
  };

export const pauseDrip = dripAction(DRIP_ENDPOINTS.PAUSE);
export const resumeDrip = dripAction(DRIP_ENDPOINTS.RESUME);
export const archiveDrip = dripAction(DRIP_ENDPOINTS.ARCHIVE);

export const getDripReport = async (dripId: string) => {
  const res = await api.get<ApiResponse<{ report: DripReport }>>(
    DRIP_ENDPOINTS.REPORT(dripId)
  );
  return dataOf(res.data).report;
};

/** The drips a contact is in now, then the ones they recently left. */
export const listContactDrips = async (subscriberId: string) => {
  const res = await api.get<ApiResponse<{ drips: ContactDripRow[] }>>(
    DRIP_ENDPOINTS.FOR_CONTACT(subscriberId)
  );
  return dataOf(res.data).drips;
};
