export type ExampleCell = string | number | null;

export interface ExampleDefinition {
  id: string;
  name: string;
  description: string;
  data: ExampleCell[][];
}

const eventBudgetExample: ExampleDefinition = {
  id: "event-budget",
  name: "Event Budget",
  description: "Estimate whether ticket revenue covers uncertain event costs.",
  data: [
    ["Event Budget", null, null, "Outputs", null],
    ["Expected Guests", "U(80, 120)", null, "Ticket Revenue", "=B2*B3"],
    ["Ticket Price", 125, null, "Total Cost", "=B5+B6*B2+B7"],
    [null, null, null, "Profit / Loss", "=E2-E3"],
    ["Venue Cost", "N.CI(4500, 6500)", null, null, null],
    ["Catering Per Guest", "N.CI(35, 55)", null, null, null],
    ["Marketing Cost", "N.CI(1200, 2400)", null, null, null],
  ],
};

const projectTimelineExample: ExampleDefinition = {
  id: "project-timeline",
  name: "Project Timeline",
  description: "Forecast delivery time when scope and team capacity are fuzzy.",
  data: [
    ["Project Timeline", null, null, "Outputs", null],
    ["Remaining Tasks", "U(18, 26)", null, "Total Work Hours", "=B2*B3+B5"],
    ["Hours Per Task", "N.CI(3, 5)", null, "Weeks To Finish", "=E2/B4"],
    ["Team Hours Per Week", "N.CI(60, 80)", null, null, null],
    ["Interruption Hours", "U(0, 12)", null, null, null],
  ],
};

const salesForecastExample: ExampleDefinition = {
  id: "sales-forecast",
  name: "Sales Forecast",
  description: "Turn uncertain traffic, conversion, and order value into revenue.",
  data: [
    ["Sales Forecast", null, null, "Outputs", null],
    ["Monthly Visitors", "U(8000, 12000)", null, "Orders", "=B2*B3"],
    ["Conversion Rate", "N.CI(0.025, 0.045)", null, "Gross Revenue", "=E2*B4"],
    ["Average Order Value", "N.CI(65, 85)", null, "Net Revenue", "=E3*(1-B5)"],
    ["Refund Rate", "U(0.04, 0.08)", null, null, null],
  ],
};

export const spreadsheetExamples: ExampleDefinition[] = [
  eventBudgetExample,
  projectTimelineExample,
  salesForecastExample,
];
