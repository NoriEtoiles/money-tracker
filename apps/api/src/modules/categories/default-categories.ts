export type DefaultCategoryDefinition = {
  colorToken: string;
  iconToken: string;
  kind: "expense" | "income";
  name: string;
  sortOrder: number;
};

export const defaultCategories = [
  {
    colorToken: "green",
    iconToken: "wallet",
    kind: "income",
    name: "Salary",
    sortOrder: 10
  },
  {
    colorToken: "teal",
    iconToken: "briefcase",
    kind: "income",
    name: "Freelance",
    sortOrder: 20
  },
  {
    colorToken: "blue",
    iconToken: "gift",
    kind: "income",
    name: "Bonus",
    sortOrder: 30
  },
  {
    colorToken: "orange",
    iconToken: "utensils",
    kind: "expense",
    name: "Food",
    sortOrder: 110
  },
  {
    colorToken: "indigo",
    iconToken: "car",
    kind: "expense",
    name: "Transportation",
    sortOrder: 120
  },
  {
    colorToken: "red",
    iconToken: "home",
    kind: "expense",
    name: "Housing",
    sortOrder: 130
  },
  {
    colorToken: "purple",
    iconToken: "shopping-bag",
    kind: "expense",
    name: "Shopping",
    sortOrder: 140
  },
  {
    colorToken: "cyan",
    iconToken: "receipt",
    kind: "expense",
    name: "Bills",
    sortOrder: 150
  },
  {
    colorToken: "pink",
    iconToken: "heart-pulse",
    kind: "expense",
    name: "Health",
    sortOrder: 160
  },
  {
    colorToken: "slate",
    iconToken: "more-horizontal",
    kind: "expense",
    name: "Other",
    sortOrder: 190
  }
] as const satisfies DefaultCategoryDefinition[];
