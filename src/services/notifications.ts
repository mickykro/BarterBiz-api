import { prisma } from "../lib/prisma.js";

export async function notify(businessId: string, params: {
  type: string;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  return prisma.notification.create({
    data: {
      businessId,
      type: params.type,
      title: params.title,
      body: params.body,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
    },
  });
}

export async function notifyMany(businessIds: string[], params: {
  type: string;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  if (businessIds.length === 0) return;
  await prisma.notification.createMany({
    data: businessIds.map((id) => ({
      businessId: id,
      type: params.type,
      title: params.title,
      body: params.body,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
    })),
  });
}
