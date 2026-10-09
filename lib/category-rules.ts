import { prisma } from "./prisma";

/**
 * Validate a category's placement and dates. Categories have two levels: main
 * categories and sub-categories under them. Returns an error message or null.
 */
export async function checkCategory(input: {
  projectId: string;
  id?: string;
  parentId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
}): Promise<{ field: string; message: string } | null> {
  if (input.startDate && input.dueDate && input.startDate > input.dueDate) {
    return { field: "dueDate", message: "Hạn hoàn thành phải sau ngày bắt đầu" };
  }
  if (!input.parentId) return null;
  if (input.parentId === input.id) return { field: "parentId", message: "Hạng mục không thể nằm trong chính nó" };

  const parent = await prisma.category.findUnique({
    where: { id: input.parentId },
    select: { projectId: true, parentId: true },
  });
  if (!parent || parent.projectId !== input.projectId) return { field: "parentId", message: "Hạng mục lớn không hợp lệ" };
  if (parent.parentId) return { field: "parentId", message: "Chỉ có hai cấp: hạng mục lớn và hạng mục con" };
  if (input.id && (await prisma.category.count({ where: { parentId: input.id } })) > 0) {
    return { field: "parentId", message: "Hạng mục đang có hạng mục con nên không thể chuyển thành hạng mục con" };
  }
  return null;
}
