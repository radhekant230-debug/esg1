// Where each role lands after signing in (same routes the password login uses)
export const dashboardPath = (role) =>
    role === "admin" ? "/admin/dashboard" : role === "manager" ? "/manager/dashboard" : "/client/dashboard";
