/** Lower case without Vietnamese marks, so "ngan hang" finds "Ngân hàng". */
export const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
