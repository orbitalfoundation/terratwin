import { Switch, Route } from "wouter";
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

function Router() {
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StoryProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </StoryProvider>
    </QueryClientProvider>
  );
}

export default App;
