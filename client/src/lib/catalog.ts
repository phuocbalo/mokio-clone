// The house toolkit's layouts. Shared by the web app and the server's AI prompts.
export type Kind = "auth" | "dashboard" | "board" | "table" | "detail" | "inbox" | "settings";
export type Nav = "side" | "top" | "rail";
export type Role = "owner" | "designer" | "reviewer" | "developer";

export const KINDS: Kind[] = ["auth", "dashboard", "board", "table", "detail", "inbox", "settings"];
export const NAVS: Nav[] = ["side", "top", "rail"];

export const NAV_INFO: Record<Nav, { name: string; why: string }> = {
  side: { name: "Sidebar", why: "Room for many sections and their labels." },
  top: { name: "Top bar", why: "Gives the full width to the content." },
  rail: { name: "Icon rail", why: "Keeps every section one click away in 56 pixels." },
};

export const LAYOUTS: Record<Kind, { name: string; why: string }[]> = {
  board: [
    { name: "Columns", why: "One column per stage; cards move left to right." },
    { name: "Swimlanes", why: "One lane per person, so load is visible at a glance." },
    { name: "Grouped list", why: "Twice as many cards on screen, at the cost of the board feel." },
  ],
  table: [
    { name: "Grid", why: "Dense rows for scanning and sorting." },
    { name: "Grid with record panel", why: "Open a row without leaving the list." },
    { name: "Gallery", why: "Cards with a cover, for records people recognise by sight." },
  ],
  detail: [
    { name: "Main with details panel", why: "Fields stay visible while reading." },
    { name: "Single column with tabs", why: "One thing at a time; holds up in small windows." },
    { name: "Main with activity rail", why: "History is always in view." },
  ],
  inbox: [
    { name: "List and reading pane", why: "Read without losing your place in the list." },
    { name: "Full-width list", why: "More of each line; items open full screen." },
    { name: "Grouped by day", why: "Shows the rhythm of the week." },
  ],
  dashboard: [
    { name: "Tiles then lists", why: "Recent work first, then what needs attention." },
    { name: "Two lists", why: "Assigned work beside recent activity." },
    { name: "Chart first", why: "Leads with the trend." },
  ],
  settings: [
    { name: "Sections on the left", why: "Jump between groups of settings." },
    { name: "Single column", why: "Everything in one scroll." },
    { name: "Tabs", why: "Short pages with two-column fields." },
  ],
  auth: [
    { name: "Centred card", why: "Familiar and quick." },
    { name: "Split with brand panel", why: "Room to say what the product is." },
    { name: "Plain, left-aligned", why: "Feels like the app, not a gate." },
  ],
};

export const KIND_LABEL: Record<Kind, string> = {
  auth: "Sign-in", dashboard: "Home", board: "Board", table: "Table", detail: "Detail", inbox: "List", settings: "Form",
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner", designer: "Designer", reviewer: "Reviewer", developer: "Developer",
};

export type Action =
  | "comment" | "approve" | "send" | "pick" | "apply" | "create" | "editLibrary"
  | "archive" | "commit" | "merge" | "spec" | "brief" | "team";

export const CAN: Record<Role, Action[]> = {
  owner: ["comment", "approve", "send", "pick", "apply", "create", "editLibrary", "archive", "commit", "merge", "spec", "brief", "team"],
  designer: ["comment", "approve", "send", "pick", "apply", "create", "commit", "merge", "spec", "brief"],
  reviewer: ["comment", "approve", "pick", "spec"],
  developer: ["comment"],
};

export const WHY_NOT: Record<Action, string> = {
  comment: "Anyone signed in can comment.",
  approve: "Developers read the prototype; reviewers, designers and owners approve screens.",
  send: "Only designers and owners can send a review to Claude. Your comments stay in the shared draft.",
  pick: "Developers cannot pick an option.",
  apply: "Only designers and owners can apply an option to the prototype.",
  create: "Only designers and owners can create or duplicate.",
  editLibrary: "Only owners can edit a library design system. Duplicate it to experiment.",
  archive: "Only owners can archive a prototype.",
  commit: "Only designers and owners can commit, push, pull or change branch. You can read the history.",
  merge: "Only designers and owners can merge a pull request. Reviewers approve it.",
  spec: "Developers read the spec and ask questions through review comments. Reviewers, designers and owners edit it.",
  brief: "Only designers and owners can send a brief to Claude.",
  team: "Only owners can change someone's role.",
};

export const can = (role: Role | undefined | null, a: Action) => !!role && CAN[role].includes(a);
