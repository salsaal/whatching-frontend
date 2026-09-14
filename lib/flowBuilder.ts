import { Edge } from "@xyflow/react";

import {
  BotActionType,
  BotBlockType,
  BotCanvasNode,
  BotCanvasNodeContent
} from "@/client-api/types/bot.type";
import { BotFlowNodeData, BotFlowReactNode } from "@/components/flows/BotFlowNode";

export type BuilderNodeData = BotFlowNodeData & {
  content: BotCanvasNodeContent;
  followUp?: BotCanvasNode["followUp"];
};
export type BuilderNode = BotFlowReactNode & { data: BuilderNodeData };

export type GenericCarouselCard = {
  title?: string;
  bodyText?: string;
  mediaType?: "image" | "document" | "video";
  mediaId?: string;
  mediaName?: string;
  buttons?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};
export type ListRow = {
  id?: string;
  replyId?: string;
  title?: string;
  label?: string;
  description?: string;
  type?: BotActionType;
  url?: string;
  [key: string]: unknown;
};
export type ListSection = {
  title?: string;
  rows?: ListRow[];
  [key: string]: unknown;
};

export const REPLY_BUTTON_LABEL_MAX = 20;
export const LIST_ROW_TITLE_MAX = 24;
export const LIST_ROW_DESCRIPTION_MAX = 72;
export const LIST_ROW_ID_MAX = 200;
export const LIST_SECTION_TITLE_MAX = 24;
export const LIST_BUTTON_TEXT_MAX = 20;
export const LIST_MAX_SECTIONS = 10;
export const LIST_MAX_ROWS_PER_SECTION = 10;

export const slugifyTrigger = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "FLOW_NODE";

export const makeListRow = (label = "Option 1", index = 0): ListRow => ({
  id: slugifyTrigger(label || `ITEM_${index + 1}`),
  replyId: slugifyTrigger(label || `ITEM_${index + 1}`),
  title: label,
  description: ""
});

export const getListSections = (
  content: BotCanvasNodeContent
): ListSection[] => {
  const rawSections = Array.isArray(content.sections)
    ? (content.sections as ListSection[])
    : [];
  const sections = rawSections.map((section, sectionIndex) => ({
    ...section,
    title:
      typeof section.title === "string"
        ? section.title
        : `Section ${sectionIndex + 1}`,
    rows: Array.isArray(section.rows)
      ? section.rows.map((row, rowIndex) => {
          const label =
            typeof row.title === "string"
              ? row.title
              : typeof row.label === "string"
                ? row.label
                : `Option ${rowIndex + 1}`;
          const id = String(
            row.id ||
              row.replyId ||
              slugifyTrigger(label || `ITEM_${rowIndex + 1}`)
          );
          return {
            ...row,
            id,
            replyId: String(row.replyId || id),
            title: label,
            description:
              typeof row.description === "string" ? row.description : ""
          };
        })
      : []
  }));

  return sections.length
    ? sections
    : [{ title: "Main options", rows: [makeListRow()] }];
};

export const getListRowCount = (sections: ListSection[]) =>
  sections.reduce(
    (count, section) =>
      count + (Array.isArray(section.rows) ? section.rows.length : 0),
    0
  );

export const defaultContent = (
  blockType: BotBlockType
): BotCanvasNodeContent => {
  if (blockType === "text") return { text: "Write your message here." };
  if (blockType === "buttons") return { bodyText: "Choose an option:" };
  if (blockType === "list") {
    return {
      bodyText: "Select from the menu:",
      buttonText: "Open menu",
      sections: [{ title: "Main options", rows: [makeListRow()] }]
    };
  }
  if (blockType === "image") return { mediaType: "image", mediaId: "" };
  if (blockType === "document") return { mediaType: "document", mediaId: "" };
  if (blockType === "video") return { mediaType: "video", mediaId: "" };
  if (blockType === "location") {
    return {
      latitude: 0,
      longitude: 0,
      name: "",
      address: ""
    };
  }
  if (blockType === "location_request") {
    return {
      bodyText: "Please share your current location."
    };
  }
  if (blockType === "address_request") {
    return {
      bodyText: "Please share your delivery address.",
      country: "IN"
    };
  }
  if (blockType === "contacts") {
    return {
      contacts: [
        {
          name: {
            formatted_name: "Support Team",
            first_name: "Support"
          },
          phones: [
            {
              phone: "",
              type: "WORK",
              wa_id: ""
            }
          ],
          emails: [
            {
              email: "",
              type: "WORK"
            }
          ],
          urls: [
            {
              url: "",
              type: "WORK"
            }
          ]
        }
      ]
    };
  }
  if (blockType === "handoff_to_agent") {
    return {
      message: "I’m connecting you to a human agent now.",
      reason: "canvas_handoff_to_agent"
    };
  }
  if (blockType === "product_carousel") {
    return {
      catalogId: "",
      sections: [{ title: "Products", productRetailerIds: [] }]
    };
  }
  return {
    bodyText: "Browse these options:",
    cards: [
      {
        title: "Card 1",
        bodyText: "Card description",
        mediaType: "image",
        mediaId: "",
        buttons: [
          { type: "quick_reply", replyId: "CARD_1", label: "Learn more" }
        ]
      },
      {
        title: "Card 2",
        bodyText: "Card description",
        mediaType: "image",
        mediaId: "",
        buttons: [
          { type: "quick_reply", replyId: "CARD_2", label: "Learn more" }
        ]
      }
    ]
  };
};

export const getCarouselCards = (
  content: BotCanvasNodeContent
): GenericCarouselCard[] =>
  Array.isArray(content.cards)
    ? (content.cards as GenericCarouselCard[])
    : (defaultContent("generic_carousel").cards as GenericCarouselCard[]);

export const localValidate = (nodes: BuilderNode[], edges: Edge[]) => {
  const invalidIds = new Set<string>();
  const messages: string[] = [];
  const byHandle = new Set(
    edges.map((edge) => `${edge.source}:${edge.sourceHandle}`)
  );
  const triggerKeys = new Set(nodes.map((node) => node.data.triggerKey));
  const triggerCounts = nodes.reduce((counts, node) => {
    counts.set(
      node.data.triggerKey,
      (counts.get(node.data.triggerKey) || 0) + 1
    );
    return counts;
  }, new Map<string, number>());

  if (!triggerKeys.has("DEFAULT")) {
    messages.push("Main Menu must keep trigger key DEFAULT.");
    invalidIds.add(nodes[0]?.id || "");
  }
  if (!triggerKeys.has("OPT_OUT")) {
    messages.push("Opt-out block must keep trigger key OPT_OUT.");
    invalidIds.add(nodes[0]?.id || "");
  }
  if (!triggerKeys.has("OPT_IN")) {
    messages.push("Opt-in block must keep trigger key OPT_IN.");
    invalidIds.add(nodes[0]?.id || "");
  }

  nodes.forEach((node) => {
    const content = node.data.content;
    const title = node.data.label;
    if ((triggerCounts.get(node.data.triggerKey) || 0) > 1) {
      invalidIds.add(node.id);
      messages.push(
        `${title}: trigger key "${node.data.triggerKey}" is duplicated.`
      );
    }
    if (!node.data.label?.trim() || !node.data.triggerKey.trim()) {
      invalidIds.add(node.id);
      messages.push(`${title || "Block"}: name and trigger key are required.`);
    }
    if (node.data.blockType === "text" && !String(content.text || "").trim()) {
      invalidIds.add(node.id);
      messages.push(`${title}: message text is required.`);
    }
    if (
      node.data.blockType === "buttons" &&
      !String(content.bodyText || "").trim()
    ) {
      invalidIds.add(node.id);
      messages.push(`${title}: message body is required.`);
    }
    if (
      node.data.blockType === "list" &&
      (!String(content.bodyText || "").trim() ||
        !String(content.buttonText || "").trim())
    ) {
      invalidIds.add(node.id);
      messages.push(`${title}: list body and button text are required.`);
    }
    if (
      ["image", "document", "video"].includes(node.data.blockType) &&
      !String(content.mediaId || "").trim()
    ) {
      invalidIds.add(node.id);
      messages.push(`${title}: select media from the properties panel.`);
    }
    if (
      node.data.blockType === "location" &&
      (content.latitude === undefined || content.longitude === undefined)
    ) {
      invalidIds.add(node.id);
      messages.push(`${title}: pick a location on the map.`);
    }
    if (
      node.data.blockType === "location_request" &&
      !String(content.bodyText || "").trim()
    ) {
      invalidIds.add(node.id);
      messages.push(`${title}: location request message is required.`);
    }
    if (
      node.data.blockType === "handoff_to_agent" &&
      !String(content.message || content.text || "").trim()
    ) {
      invalidIds.add(node.id);
      messages.push(`${title}: agent handoff message is required.`);
    }
    if (node.data.blockType === "address_request") {
      if (!String(content.bodyText || "").trim()) {
        invalidIds.add(node.id);
        messages.push(`${title}: address request message is required.`);
      }
      if (
        String(content.country || "IN")
          .trim()
          .toUpperCase() !== "IN"
      ) {
        invalidIds.add(node.id);
        messages.push(`${title}: address request supports country IN only.`);
      }
    }
    if (node.data.blockType === "contacts") {
      const contacts = Array.isArray(content.contacts)
        ? (content.contacts as Array<Record<string, unknown>>)
        : [];
      const hasNamedContact = contacts.some((contact) => {
        const name = contact.name as Record<string, unknown> | undefined;
        return String(name?.formatted_name || "").trim();
      });
      const hasValidPhone = contacts.some((contact) => {
        const phones = contact.phones as
          | Array<Record<string, unknown>>
          | undefined;
        return String(phones?.[0]?.phone || "").replace(/\D/g, "").length >= 7;
      });
      if (!hasNamedContact) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: add at least one contact with a formatted name.`
        );
      }
      if (!hasValidPhone) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: select a country code and enter a valid phone number.`
        );
      }
    }
    if (
      node.data.blockType === "product_carousel" &&
      !String(content.catalogId || "").trim()
    ) {
      invalidIds.add(node.id);
      messages.push(`${title}: catalog ID is required.`);
    }
    if (node.data.blockType === "buttons" && node.data.actions.length > 3) {
      invalidIds.add(node.id);
      messages.push(
        `${title}: WhatsApp reply button messages support at most 3 buttons.`
      );
    }
    if (node.data.blockType === "buttons" && content.mediaType) {
      if (!String(content.mediaId || "").trim()) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: media header requires media from the library.`
        );
      }
      if (!["image", "document", "video"].includes(String(content.mediaType))) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: media header must be image, document, or video.`
        );
      }
    }
    if (node.data.blockType === "buttons") {
      node.data.actions.forEach((action) => {
        const label = String(action.label || "").trim();
        if (label.length < 1 || label.length > REPLY_BUTTON_LABEL_MAX) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: button "${label || "Untitled"}" must be 1-${REPLY_BUTTON_LABEL_MAX} characters.`
          );
        }
      });
    }
    if (node.data.blockType === "list") {
      const sections = getListSections(content);
      const rowCount = getListRowCount(sections);
      const rowIds = new Set<string>();
      if (sections.length > LIST_MAX_SECTIONS) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: WhatsApp list messages support at most ${LIST_MAX_SECTIONS} sections.`
        );
      }
      if (rowCount < 1) {
        invalidIds.add(node.id);
        messages.push(`${title}: list block requires at least 1 row.`);
      }
      sections.forEach((section, sectionIndex) => {
        if ((section.rows || []).length > LIST_MAX_ROWS_PER_SECTION) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: section ${sectionIndex + 1} supports at most ${LIST_MAX_ROWS_PER_SECTION} rows.`
          );
        }
      });
      if (String(content.buttonText || "").length > LIST_BUTTON_TEXT_MAX) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: list button text must be ${LIST_BUTTON_TEXT_MAX} characters or less.`
        );
      }
      sections.forEach((section, sectionIndex) => {
        const sectionTitle = String(section.title || "").trim();
        if (
          sectionTitle.length < 1 ||
          sectionTitle.length > LIST_SECTION_TITLE_MAX
        ) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: section ${sectionIndex + 1} title must be 1-${LIST_SECTION_TITLE_MAX} characters.`
          );
        }
        (section.rows || []).forEach((row) => {
          const label = String(row.title || row.label || "").trim();
          const rowId = String(row.id || row.replyId || "").trim();
          const description = String(row.description || "");
          if (label.length < 1 || label.length > LIST_ROW_TITLE_MAX) {
            invalidIds.add(node.id);
            messages.push(
              `${title}: list row "${label || "Untitled"}" must be 1-${LIST_ROW_TITLE_MAX} characters.`
            );
          }
          if (rowId.length < 1 || rowId.length > LIST_ROW_ID_MAX) {
            invalidIds.add(node.id);
            messages.push(
              `${title}: list row "${label || "Untitled"}" id must be 1-${LIST_ROW_ID_MAX} characters.`
            );
          }
          if (rowIds.has(rowId)) {
            invalidIds.add(node.id);
            messages.push(`${title}: list row id "${rowId}" is duplicated.`);
          }
          rowIds.add(rowId);
          if (description.length > LIST_ROW_DESCRIPTION_MAX) {
            invalidIds.add(node.id);
            messages.push(
              `${title}: list row "${label || "Untitled"}" description must be ${LIST_ROW_DESCRIPTION_MAX} characters or less.`
            );
          }
        });
      });
    }
    if (node.data.blockType === "generic_carousel") {
      const cards = getCarouselCards(content);
      if (cards.length < 2 || cards.length > 10) {
        invalidIds.add(node.id);
        messages.push(`${title}: carousel must include 2-10 cards.`);
      }
      const firstButtons = (cards[0]?.buttons || []) as Array<
        Record<string, unknown>
      >;
      const firstTypes = firstButtons.map((button) =>
        String(button.type || (button.url ? "url" : "quick_reply"))
      );
      cards.forEach((card, cardIndex) => {
        if (!String(card.bodyText || "").trim()) {
          invalidIds.add(node.id);
          messages.push(`${title}: card ${cardIndex + 1} needs body text.`);
        }
        if (!["image", "video"].includes(String(card.mediaType || ""))) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: card ${cardIndex + 1} needs image or video media.`
          );
        }
        if (!String(card.mediaId || "").trim()) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: card ${cardIndex + 1} needs media selected from the library.`
          );
        }
        const buttons = (card.buttons || []) as Array<Record<string, unknown>>;
        if (!buttons.length) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: card ${cardIndex + 1} needs at least one button.`
          );
        }
        buttons.forEach((button) => {
          const label = String(button.label || button.title || "").trim();
          if (label.length < 1 || label.length > REPLY_BUTTON_LABEL_MAX) {
            invalidIds.add(node.id);
            messages.push(
              `${title}: carousel button "${label || "Untitled"}" must be 1-${REPLY_BUTTON_LABEL_MAX} characters.`
            );
          }
        });
        if (
          buttons.length !== firstTypes.length ||
          buttons.some(
            (button, buttonIndex) =>
              String(button.type || (button.url ? "url" : "quick_reply")) !==
              firstTypes[buttonIndex]
          )
        ) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: carousel button count and type must match on every card.`
          );
        }
      });
    }

    node.data.actions
      .filter((action) => action.type === "go_to_trigger")
      .forEach((action) => {
        if (
          node.data.triggerKey === "OPT_IN" ||
          node.data.triggerKey === "OPT_OUT"
        ) {
          return;
        }
        const possibleHandleIds = [action.actionId, action.replyId].filter(
          Boolean
        );
        const isConnected = possibleHandleIds.some((handleId) =>
          byHandle.has(`${node.id}:${handleId}`)
        );
        if (!isConnected) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: route "${action.label || "option"}" is not connected.`
          );
        }
      });
    node.data.actions
      .filter((action) => action.type === "open_url")
      .forEach((action) => {
        if (
          node.data.blockType !== "generic_carousel" &&
          node.data.blockType !== "buttons"
        ) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: Open Website is only supported by button and carousel blocks.`
          );
        } else if (!/^https?:\/\//i.test(String(action.url || "").trim())) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: URL action "${action.label || "button"}" needs a valid http(s) URL.`
          );
        }
      });
    if (node.data.blockType === "buttons") {
      const websiteButtons = node.data.actions.filter(
        (action) => action.type === "open_url"
      );
      const replyButtons = node.data.actions.filter(
        (action) => action.type !== "open_url"
      );
      if (websiteButtons.length && replyButtons.length) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: website buttons cannot be mixed with quick replies.`
        );
      }
      if (websiteButtons.length > 1) {
        invalidIds.add(node.id);
        messages.push(`${title}: only one website button is supported.`);
      }
    }
  });

  // Orphan detection is a warning, not a blocker (added to `messages` only,
  // never `invalidIds`) -- an unreachable block may still be a work-in-progress
  // draft the user hasn't wired up yet, so it shouldn't block save/publish.
  const reachable = new Set<string>();
  const entryNode = nodes.find((node) => node.data.triggerKey === "DEFAULT");
  if (entryNode) {
    const queue = [entryNode.id];
    reachable.add(entryNode.id);
    while (queue.length) {
      const currentId = queue.shift()!;
      edges
        .filter((edge) => edge.source === currentId)
        .forEach((edge) => {
          if (!reachable.has(edge.target)) {
            reachable.add(edge.target);
            queue.push(edge.target);
          }
        });
      const currentNode = nodes.find((node) => node.id === currentId);
      const followUpTargetId = currentNode?.data.followUp?.enabled
        ? nodes.find(
            (candidate) =>
              candidate.data.triggerKey ===
              currentNode.data.followUp?.targetTriggerKey
          )?.id
        : undefined;
      if (followUpTargetId && !reachable.has(followUpTargetId)) {
        reachable.add(followUpTargetId);
        queue.push(followUpTargetId);
      }
    }
  }
  nodes.forEach((node) => {
    if (
      node.data.triggerKey === "OPT_IN" ||
      node.data.triggerKey === "OPT_OUT" ||
      node.data.locked ||
      reachable.has(node.id)
    ) {
      return;
    }
    messages.push(
      `${node.data.label}: unreachable — no route from Main Menu leads to this block.`
    );
  });

  if (invalidIds.size && messages.length === 0) {
    messages.push("Some blocks are missing required content.");
  }
  return { invalidIds, messages };
};
