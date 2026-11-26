import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaAsset } from "@/client-api/types/media.type";
import type { Subscriber } from "@/client-api/types/subscribers.type";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (text: string) => toastError(text) }
}));

const uploadMedia = vi.fn();
vi.mock("@/client-api/functions/media", () => ({
  uploadMedia: (files: File[], options: unknown) => uploadMedia(files, options),
  getAllMedia: () => Promise.resolve({ status: "success", data: { media: [] } })
}));
vi.mock("@/client-api/functions/campaigns", () => ({
  getSubscriberCampaignTouches: () =>
    Promise.resolve({
      status: "success",
      data: { campaignSources: [], touches: [] }
    })
}));
vi.mock("@/client-api/functions/subscribers", () => ({
  updateSubscriberBroadcastEligibility: vi.fn(),
  updateSubscriber: vi.fn()
}));
vi.mock("next/router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const access = { manageMedia: true };
vi.mock("@/hooks/useCurrentMembership", () => ({
  useCurrentMembership: () => ({
    can: (permission: string) =>
      permission === "media:manage" ? access.manageMedia : true
  })
}));

const { MediaUploadButton } = await import(
  "@/components/media/MediaUploadButton"
);
const { default: MediaPickerDialog } = await import(
  "@/components/media/MediaPickerDialog"
);
const { default: SubscriberModal } = await import(
  "@/components/subscribers/SubscriberModal"
);

const wrap = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
};

const uploaded: MediaAsset = {
  _id: "m-1",
  orgId: "org-1",
  name: "menu.png",
  fileType: "image",
  fileSize: 2048,
  cloudinaryUrl: "https://cdn.example.test/menu.png",
  metaHandle: "",
  createdAt: "",
  updatedAt: ""
};

const choose = (name: string, type: string) =>
  fireEvent.change(screen.getByLabelText("Upload a file"), {
    target: { files: [new File(["x"], name, { type })] }
  });

afterEach(cleanup);
beforeEach(() => {
  toastError.mockReset();
  uploadMedia.mockReset();
  access.manageMedia = true;
});

describe("Upload from a media slot", () => {
  it("uploads the file and hands it to the slot", async () => {
    uploadMedia.mockResolvedValue({
      status: "success",
      data: { media: [uploaded] }
    });
    const onUploaded = vi.fn();
    wrap(<MediaUploadButton kind="image" onUploaded={onUploaded} />);

    expect(screen.getByLabelText("Upload a file").getAttribute("accept")).toBe(
      ".jpg,.jpeg,.png,image/jpeg,image/png"
    );
    choose("menu.png", "image/png");
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(uploaded));
    expect(uploadMedia.mock.calls[0][0][0].name).toBe("menu.png");
  });

  it("refuses WebP before uploading", () => {
    const onUploaded = vi.fn();
    wrap(<MediaUploadButton kind="image" onUploaded={onUploaded} />);
    choose("photo.webp", "image/webp");
    expect(toastError).toHaveBeenCalledWith("Use a JPG or PNG image.");
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it("shows the backend's message when the upload fails", async () => {
    uploadMedia.mockRejectedValue({
      response: { data: { message: "Cloudinary failed for menu.png" } }
    });
    wrap(<MediaUploadButton kind="image" onUploaded={vi.fn()} />);
    choose("menu.png", "image/png");
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Cloudinary failed for menu.png")
    );
  });

  it("is hidden for people who can't add media", () => {
    access.manageMedia = false;
    wrap(<MediaUploadButton kind="image" onUploaded={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Upload/ })).toBeNull();
  });

  it("picks the uploaded file in the media picker", async () => {
    uploadMedia.mockResolvedValue({
      status: "success",
      data: { media: [uploaded] }
    });
    const onSelect = vi.fn();
    wrap(
      <MediaPickerDialog
        open
        requiredType="IMAGE"
        onOpenChange={vi.fn()}
        onSelect={onSelect}
      />
    );
    expect(screen.getByRole("button", { name: "Upload" })).toBeTruthy();
    choose("menu.png", "image/png");
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(uploaded));
  });
});

describe("contact custom fields", () => {
  it("shows the saved custom fields on the contact", () => {
    const subscriber = {
      _id: "s-1",
      orgId: "org-1",
      phoneNumber: "+919876543210",
      firstName: "Priya",
      tags: [],
      isOptedIn: true,
      metadata: { city: "Pune", orders: 3 },
      createdAt: "",
      updatedAt: ""
    } as Subscriber;
    wrap(
      <SubscriberModal
        open
        subscriber={subscriber}
        isSaving={false}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("Custom fields")).toBeTruthy();
    expect(screen.getByText("city")).toBeTruthy();
    expect(screen.getByText("Pune")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
});
