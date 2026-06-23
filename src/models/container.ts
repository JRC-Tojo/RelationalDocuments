import z from 'zod';

export const ContainerID = z.uuidv4().brand('ContainerID');
export type ContainerID = z.infer<typeof ContainerID>;

export const ContainerElementFile = z.object({
  containerID: ContainerID,
  type: z.literal('File'),
  path: z.string(),
  name: z.string(),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastViewedAt: z.date().optional(),
  description: z.string().optional().default(''),
  genre: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
});
export type ContainerElementFile = z.infer<typeof ContainerElementFile>;
export const ContainerElementFolder = z.object({
  containerID: ContainerID,
  type: z.literal('Folder'),
  name: z.string(),
  path: z.string(),
  createdAt: z.date(),
});
export type ContainerElementFolder = z.infer<typeof ContainerElementFolder>;
export const ContainerElement = z.discriminatedUnion('type', [
  ContainerElementFile,
  ContainerElementFolder,
]);
export type ContainerElement = z.infer<typeof ContainerElement>;

export const ContainerType = z.enum(['box', 'cache', 'local']);
export type ContainerType = z.infer<typeof ContainerType>;
export const Container = z.object({
  id: ContainerID,
  name: z.string(),
  type: ContainerType,
  containerPath: z.string(),
  elements: ContainerElement.array().optional(),
});
export type Container = z.infer<typeof Container>;
