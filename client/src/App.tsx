import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AddPlot from "@/pages/add-plot";
import PlotDetail from "@/pages/plot-detail";
import Navigation from "@/components/navigation";
import { StoryProvider } from "@/hooks/use-story";
import { StoryOverlay } from "@/components/story-overlay";
import { isLocalMode } from "@/lib/config";

function AppRoutes() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <StoryOverlay />
      <Navigation />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/plots/new" component={AddPlot} />
        <Route path="/plots/edit/:id" component={AddPlot} />
        <Route path="/plots/:id" component={PlotDetail} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

// Local/static mode uses hash routing so GitHub Pages deep links work without a 404.
// Server mode uses the default browser history routing.
function AppRouter() {
  if (isLocalMode) {
    return (
      <Router hook={useHashLocation}>
        <AppRoutes />
      </Router>
    );
  }
  return <AppRoutes />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StoryProvider>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </StoryProvider>
    </QueryClientProvider>
  );
}

export default App;
