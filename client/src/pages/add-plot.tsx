import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertPlotSchema, type InsertPlot } from "@shared/schema";

const bambooTypes = [
  "Moso Bamboo",
  "Giant Timber Bamboo", 
  "Black Bamboo",
  "Golden Bamboo",
  "Buddha's Belly Bamboo",
  "Clumping Bamboo",
];

export default function AddPlot() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InsertPlot>({
    resolver: zodResolver(insertPlotSchema),
    defaultValues: {
      status: "planning",
    },
  });

  const createPlotMutation = useMutation({
    mutationFn: async (data: InsertPlot) => {
      const response = await apiRequest("POST", "/api/plots", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plots"] });
      toast({
        title: "Success",
        description: "Plot created successfully",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create plot",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertPlot) => {
    createPlotMutation.mutate(data);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation("/")}
            className="text-muted-foreground hover:text-primary"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-light tracking-tight text-primary" data-testid="text-add-plot-title">
            Add New Plot
          </h1>
        </div>

        <div className="max-w-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" data-testid="form-add-plot">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="block text-sm font-medium mb-2">
                  Plot Name
                </Label>
                <Input
                  id="name"
                  {...register("name")}
                  className="w-full px-4 py-3 bg-input border-border"
                  placeholder="Enter plot name"
                  data-testid="input-plot-name"
                />
                {errors.name && (
                  <p className="text-destructive text-sm mt-1" data-testid="error-plot-name">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude" className="block text-sm font-medium mb-2">
                    Latitude
                  </Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    {...register("latitude", { valueAsNumber: true })}
                    className="w-full px-4 py-3 bg-input border-border"
                    placeholder="45.5231"
                    data-testid="input-latitude"
                  />
                  {errors.latitude && (
                    <p className="text-destructive text-sm mt-1" data-testid="error-latitude">
                      {errors.latitude.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="longitude" className="block text-sm font-medium mb-2">
                    Longitude
                  </Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    {...register("longitude", { valueAsNumber: true })}
                    className="w-full px-4 py-3 bg-input border-border"
                    placeholder="-122.6765"
                    data-testid="input-longitude"
                  />
                  {errors.longitude && (
                    <p className="text-destructive text-sm mt-1" data-testid="error-longitude">
                      {errors.longitude.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="area" className="block text-sm font-medium mb-2">
                  Area (m²)
                </Label>
                <Input
                  id="area"
                  type="number"
                  step="any"
                  {...register("area", { valueAsNumber: true })}
                  className="w-full px-4 py-3 bg-input border-border"
                  placeholder="124"
                  data-testid="input-area"
                />
                {errors.area && (
                  <p className="text-destructive text-sm mt-1" data-testid="error-area">
                    {errors.area.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="block text-sm font-medium mb-2">
                  Bamboo Type
                </Label>
                <Select onValueChange={(value) => setValue("bambooType", value)} data-testid="select-bamboo-type">
                  <SelectTrigger className="w-full px-4 py-3 bg-input border-border">
                    <SelectValue placeholder="Select bamboo type" />
                  </SelectTrigger>
                  <SelectContent>
                    {bambooTypes.map((type) => (
                      <SelectItem key={type} value={type} data-testid={`option-bamboo-${type.toLowerCase().replace(/\s+/g, '-')}`}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.bambooType && (
                  <p className="text-destructive text-sm mt-1" data-testid="error-bamboo-type">
                    {errors.bambooType.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="block text-sm font-medium mb-2">
                  Status
                </Label>
                <Select onValueChange={(value) => setValue("status", value as "planning" | "active" | "inactive")} defaultValue="planning" data-testid="select-status">
                  <SelectTrigger className="w-full px-4 py-3 bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning" data-testid="option-status-planning">Planning</SelectItem>
                    <SelectItem value="active" data-testid="option-status-active">Active</SelectItem>
                    <SelectItem value="inactive" data-testid="option-status-inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                {errors.status && (
                  <p className="text-destructive text-sm mt-1" data-testid="error-status">
                    {errors.status.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="notes" className="block text-sm font-medium mb-2">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  {...register("notes")}
                  rows={3}
                  className="w-full px-4 py-3 bg-input border-border"
                  placeholder="Optional notes about this plot..."
                  data-testid="textarea-notes"
                />
                {errors.notes && (
                  <p className="text-destructive text-sm mt-1" data-testid="error-notes">
                    {errors.notes.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex space-x-4">
              <Button 
                type="submit" 
                disabled={createPlotMutation.isPending}
                className="px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-create-plot"
              >
                {createPlotMutation.isPending ? "Creating..." : "Create Plot"}
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setLocation("/")}
                className="px-6 py-3 border-border hover:bg-muted"
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
