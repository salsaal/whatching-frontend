import { Instagram, UserRound } from "lucide-react";
import { useState } from "react";
import { FaWhatsapp } from "react-icons/fa";

import { refreshInstagramPicture } from "@/client-api/functions/subscribers";
import type { Conversation } from "@/client-api/types/chat.type";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/displayFormat";
import { subscriberName } from "@/lib/inbox";
import { cn } from "@/lib/utils";

// Instagram picture links expire after a few days. When one fails, the
// server is asked for a fresh link once per contact per page load; every
// avatar of that contact shares the answer.
const instagramPictureRefreshes = new Map<string, Promise<string | null>>();
const refreshInstagramPictureOnce = (subscriberId: string) => {
  let pending = instagramPictureRefreshes.get(subscriberId);
  if (!pending) {
    pending = refreshInstagramPicture(subscriberId)
      .then((result) => result.profilePictureUrl)
      .catch(() => null);
    instagramPictureRefreshes.set(subscriberId, pending);
  }
  return pending;
};

export function ContactAvatar({
  conversation,
  className,
  fallbackClassName,
  withChannel = false
}: {
  conversation: Conversation;
  className?: string;
  fallbackClassName?: string;
  withChannel?: boolean;
}) {
  const subscriberId = conversation.subscriberId?._id;
  const storedPictureUrl =
    conversation.subscriberId?.instagramProfilePictureUrl;
  // Tied to the contact: the header avatar stays mounted across chats.
  const [freshPicture, setFreshPicture] = useState<{
    subscriberId: string;
    url: string;
  } | null>(null);
  const freshPictureUrl =
    freshPicture && freshPicture.subscriberId === subscriberId
      ? freshPicture.url
      : null;
  const pictureUrl = freshPictureUrl || storedPictureUrl;
  const isInstagram = conversation.channel === "instagram";
  const handlePictureStatus = (status: string) => {
    if (status !== "error" || !subscriberId || freshPictureUrl) return;
    void refreshInstagramPictureOnce(subscriberId).then((url) => {
      // The same link would fail again; keep the initials instead.
      if (url && url !== storedPictureUrl) {
        setFreshPicture({ subscriberId, url });
      }
    });
  };
  return (
    <div className="relative shrink-0">
      <Avatar className={className}>
        {pictureUrl && (
          <AvatarImage
            src={pictureUrl}
            alt={subscriberName(conversation)}
            onLoadingStatusChange={handlePictureStatus}
          />
        )}
        <AvatarFallback
          className={cn("bg-primary/10 text-primary", fallbackClassName)}
        >
          {getInitials(subscriberName(conversation)) || (
            <UserRound className="size-[55%]" aria-hidden />
          )}
        </AvatarFallback>
      </Avatar>
      {withChannel && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-white ring-2 ring-white",
            isInstagram
              ? "bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600"
              : "bg-emerald-500"
          )}
          title={isInstagram ? "Instagram" : "WhatsApp"}
          aria-label={isInstagram ? "Instagram" : "WhatsApp"}
        >
          {isInstagram ? (
            <Instagram className="size-2.5" />
          ) : (
            <FaWhatsapp className="size-2.5" />
          )}
        </span>
      )}
    </div>
  );
}
