import { describe, expect, it } from "vitest";
import { CONTACT_LEVELS, contactsByLevel, createContactSchema, createCustomerSchema, customerMatches, updateContactSchema, type CustomerContactDto, type CustomerDto } from "@/lib/customers";

const person = (over: Partial<CustomerContactDto>): CustomerContactDto => ({
  id: Math.random().toString(36).slice(2),
  level: "STAFF",
  name: "Người",
  title: null,
  department: null,
  phone: null,
  email: null,
  birthday: null,
  note: null,
  ...over,
});

const company = (contacts: CustomerContactDto[]): CustomerDto => ({
  id: "c1",
  name: "Công ty TNHH Đông Á",
  taxCode: "0312345678",
  industry: "Sản xuất",
  address: null,
  phone: null,
  email: null,
  website: null,
  note: null,
  updatedAt: new Date(0).toISOString(),
  contacts,
  projects: [{ id: "p1", name: "Đào tạo tiếng Anh lãnh đạo", status: "ACTIVE", color: "#000" }],
});

describe("customers", () => {
  it("groups people from the director down, A to Z inside a position, every position present", () => {
    const groups = contactsByLevel([
      person({ name: "Vy", level: "STAFF" }),
      person({ name: "Bình", level: "DIRECTOR" }),
      person({ name: "An", level: "STAFF" }),
      person({ name: "Đức", level: "HEAD" }),
    ]);
    expect(groups.map((g) => g.level)).toEqual([...CONTACT_LEVELS]);
    expect(groups.map((g) => g.contacts.map((c) => c.name))).toEqual([["Bình"], [], ["Đức"], ["An", "Vy"]]);
  });

  it("finds a company by its own fields or by its people, without Vietnamese marks", () => {
    const c = company([person({ name: "Trần Thị Hạnh", phone: "0901 234 567", email: "hanh@dong-a.vn" })]);
    expect(customerMatches(c, "")).toBe(true);
    expect(customerMatches(c, "dong a")).toBe(true);
    expect(customerMatches(c, "0312345")).toBe(true);
    expect(customerMatches(c, "tran thi hanh")).toBe(true);
    expect(customerMatches(c, "hanh@")).toBe(true);
    expect(customerMatches(c, "0901 234")).toBe(true);
    expect(customerMatches(c, "tieng anh lanh dao")).toBe(true);
    expect(customerMatches(c, "khong co")).toBe(false);
  });

  it("trims text, turns empty fields into null and checks emails and dates", () => {
    expect(createCustomerSchema.parse({ name: "  ABC  ", taxCode: " ", email: "" })).toMatchObject({ name: "ABC", taxCode: null, email: null });
    expect(createCustomerSchema.safeParse({ name: " " }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ name: "ABC", email: "khong-phai-email" }).success).toBe(false);
    expect(createContactSchema.parse({ level: "DEPUTY", name: "Lan", birthday: "1990-05-02", phone: " 0909 " })).toMatchObject({ level: "DEPUTY", name: "Lan", birthday: "1990-05-02", phone: "0909" });
    expect(createContactSchema.safeParse({ level: "CEO", name: "Lan" }).success).toBe(false);
    expect(createContactSchema.safeParse({ level: "STAFF", name: "Lan", birthday: "02/05/1990" }).success).toBe(false);
    // A partial update leaves out what it does not send.
    expect(updateContactSchema.parse({ note: "Gọi lại thứ Hai" })).toEqual({ note: "Gọi lại thứ Hai" });
  });
});

describe("customer picker on the project form", async () => {
  const { matchCustomers, exactCustomer } = await import("../components/projects/customer-input");
  const list = [
    { id: "1", name: "Trường Đại học Thương mại" },
    { id: "2", name: "Trường Đại học Nha Trang" },
    { id: "3", name: "Thương mại Dịch vụ Á Châu" },
    { id: "4", name: "WayUp" },
  ];
  it("suggests listed companies holding every word typed, accents and case ignored, closest first", () => {
    expect(matchCustomers(list, "thuong mai").map((c) => c.id)).toEqual(["3", "1"]);
    expect(matchCustomers(list, "dai hoc nha").map((c) => c.id)).toEqual(["2"]);
    expect(matchCustomers(list, "")).toHaveLength(4);
    expect(matchCustomers(list, "xyz")).toEqual([]);
  });
  it("treats typing an exact listed name as choosing it", () => {
    expect(exactCustomer(list, "  wayup ")?.id).toBe("4");
    expect(exactCustomer(list, "Truong Dai hoc Thuong Mai")?.id).toBe("1");
    expect(exactCustomer(list, "WayUp Việt Nam")).toBeUndefined();
  });
});
