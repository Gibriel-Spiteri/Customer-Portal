import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/auth-context";
import { SyncProvider } from "@/contexts/sync-context";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import CustomLogin from "@/pages/custom-login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders";
import OrderDetails from "@/pages/order-details";
import Estimates from "@/pages/estimates";
import Invoices from "@/pages/invoices";
import Payments from "@/pages/payments";
import Loyalty from "@/pages/loyalty";
import AccountSettings from "@/pages/account-settings";
import Support from "@/pages/support";
import OAuthCallback from "@/pages/oauth-callback";
import Debug from "@/pages/debug";
import { NetSuiteTest } from "@/pages/netsuite-test";
import NetSuiteDebug from "@/pages/netsuite-debug";
import OAuthDebugPage from "@/pages/oauth-debug";
import { ConsumersCashPage } from "@/pages/consumers-cash";
import TestPage from "@/pages/test";

function Router() {
  return (
    <Switch>
      <Route path="/test" component={TestPage} />
      <Route path="/login" component={CustomLogin} />
      <Route path="/register" component={Register} />
      <Route path="/old-login" component={Login} />
      <Route path="/auth/netsuite/callback" component={OAuthCallback} />
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/orders" component={Orders} />
      <Route path="/orders/:id" component={OrderDetails} />
      <Route path="/estimates" component={Estimates} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/payments" component={Payments} />
      <Route path="/loyalty" component={Loyalty} />
      <Route path="/consumers-cash" component={ConsumersCashPage} />
      <Route path="/account" component={AccountSettings} />
      <Route path="/support" component={Support} />
      <Route path="/debug" component={Debug} />
      <Route path="/netsuite-test" component={NetSuiteTest} />
      <Route path="/netsuite-debug" component={NetSuiteDebug} />
      <Route path="/oauth-debug" component={OAuthDebugPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SyncProvider>
            <Toaster />
            <Router />
          </SyncProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
