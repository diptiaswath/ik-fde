import { ok, apiError, requireAuth } from "@/lib/api/respond";
import { logAudit } from "@/lib/api/audit";
import { disputeDecision } from "@/lib/api/scope";
import {
  getCustomer,
  getCustomerAccounts,
  getCustomerTransactions,
  getCustomerDisputes,
} from "@/lib/queries";

// GET /api/v1/customers/:id — Customer 360 (profile + accounts + recent txns + disputes).
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  const id = params.id;

  const customer = await getCustomer(id);
  if (!customer) {
    return apiError(404, "not_found", `Customer ${id} not found.`);
  }

  const [accounts, recent_transactions, allDisputes] = await Promise.all([
    getCustomerAccounts(id),
    getCustomerTransactions(id),
    getCustomerDisputes(id),
  ]);

  // The base customer-disputes query is NOT scope-filtered. For a scoped seat we
  // filter the disputes here for consistency with the rest of the API — a type_a
  // seat must not see Type-B disputes even via the customer 360 path.
  const disputes = allDisputes.filter(
    (d) => disputeDecision(p.scope, d.dispute_type) === "allow"
  );

  await logAudit({
    analystId: p.analystId,
    learnerId: p.learnerId,
    action: "lookup_customer",
    resourceType: "customer",
    resourceId: id,
    scope: p.scope,
    decision: "allow",
    detail: {
      accounts: accounts.length,
      disputes_visible: disputes.length,
      disputes_total: allDisputes.length,
    },
  });

  return ok({ customer, accounts, recent_transactions, disputes });
}
