import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AddPlot from "@/pages/add-plot";
import PlotDetail from "@/pages/plot-detail";
import NasaMap from "@/pages/nasa-map";
import Navigation from "@/components/navigation";

function Router() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/plots/new" component={AddPlot} />
        <Route path="/plots/:id" component={PlotDetail} />
        <Route path="/nasa-map" component={NasaMap} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div className="dark">
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
