import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertPlotSchema, type InsertPlot, type Plot } from "@shared/schema";

const bambooTypes = [
  "Moso Bamboo",
  "Giant Timber Bamboo", 
  "Black Bamboo",
  "Golden Bamboo",
  "Buddha's Belly Bamboo",
  "Clumping Bamboo",
];

export default function AddPlot() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Check if we're in edit mode
  const isEditMode = !!id;
  
  // Load existing plot data if editing
  const { data: existingPlot } = useQuery<Plot>({
    queryKey: ["/api/plots", id],
    enabled: isEditMode,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<InsertPlot>({
    resolver: zodResolver(insertPlotSchema),
    defaultValues: {
      status: "planning",
    },
  });

  // Update form when existing plot data loads
  useEffect(() => {
    if (existingPlot && isEditMode) {
      reset({
        name: existingPlot.name,
        latitude: existingPlot.latitude,
        longitude: existingPlot.longitude,
        area: existingPlot.area,
        bambooType: existingPlot.bambooType,
        status: existingPlot.status as "planning" | "active" | "inactive",
        notes: existingPlot.notes || '',
        // Species & Schedule
        speciesDensity: existingPlot.speciesDensity as "low" | "medium" | "high" || "low",
        harvestYears: existingPlot.harvestYears || 5,
        harvestRate: existingPlot.harvestRate || 20,
        // Plot Environment
        elevation: existingPlot.elevation || 0,
        slopeFacing: existingPlot.slopeFacing || 0,
        steepness: existingPlot.steepness || 0,
        rainfall: existingPlot.rainfall || 0,
        drainage: existingPlot.drainage || 5000,
        // Soil Conditions
        soilSalts: existingPlot.soilSalts || 50,
        soilNitrogen: existingPlot.soilNitrogen || 50,
        soilMicrobialMass: existingPlot.soilMicrobialMass || 50,
        soilEarthworms: existingPlot.soilEarthworms || 50,
        soilAcidity: existingPlot.soilAcidity || 7.0,
        soilFertility: existingPlot.soilFertility || 50,
        // Pests
        pestBambooBorer: existingPlot.pestBambooBorer || "false",
        pestAphids: existingPlot.pestAphids || "false",
        pestFungalPathogens: existingPlot.pestFungalPathogens || "false",
        // Intervention
        interventionWeeding: existingPlot.interventionWeeding || "false",
        interventionMulching: existingPlot.interventionMulching || "false",
        interventionFertilization: existingPlot.interventionFertilization || "false",
        interventionPestControl: existingPlot.interventionPestControl || "false",
        // Intercropping
        intercroppingLegumes: existingPlot.intercroppingLegumes || "false",
        intercroppingHerbs: existingPlot.intercroppingHerbs || "false",
        intercroppingSpecialtyCrops: existingPlot.intercroppingSpecialtyCrops || "false",
        intercroppingAnimals: existingPlot.intercroppingAnimals || "false",
      });
    }
  }, [existingPlot, isEditMode, reset]);

  const plotMutation = useMutation({
    mutationFn: async (data: InsertPlot) => {
      if (isEditMode) {
        const response = await apiRequest("PUT", `/api/plots/${id}`, data);
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/plots", data);
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plots"] });
      toast({
        title: "Success",
        description: isEditMode ? "Plot updated successfully" : "Plot created successfully",
      });
      setLocation(isEditMode ? `/plots/${id}` : "/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditMode ? 'update' : 'create'} plot`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertPlot) => {
    plotMutation.mutate(data);
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
          <h1 className="text-3xl font-light tracking-tight text-primary" data-testid={isEditMode ? "text-edit-plot-title" : "text-add-plot-title"}>
            {isEditMode ? "Edit Plot" : "Add New Plot"}
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

              {/* Species & Schedule Section */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-semibold text-primary">Species & Schedule</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block text-sm font-medium mb-2">Species Density</Label>
                    <Select onValueChange={(value) => setValue("speciesDensity", value as "low" | "medium" | "high")} data-testid="select-density">
                      <SelectTrigger className="w-full px-4 py-3 bg-input border-border">
                        <SelectValue placeholder="Select density" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="harvestYears" className="block text-sm font-medium mb-2">
                      Harvest in (years)
                    </Label>
                    <Input
                      id="harvestYears"
                      type="number"
                      {...register("harvestYears", { valueAsNumber: true })}
                      className="w-full px-4 py-3 bg-input border-border"
                      placeholder="5"
                      data-testid="input-harvest-years"
                    />
                  </div>

                  <div>
                    <Label htmlFor="harvestRate" className="block text-sm font-medium mb-2">
                      Harvest Rate (%)
                    </Label>
                    <Input
                      id="harvestRate"
                      type="number"
                      {...register("harvestRate", { valueAsNumber: true })}
                      className="w-full px-4 py-3 bg-input border-border"
                      placeholder="20"
                      data-testid="input-harvest-rate"
                    />
                  </div>
                </div>
              </div>

              {/* Plot Environment Section */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-semibold text-primary">Plot Environment</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="elevation" className="block text-sm font-medium mb-2">
                      Elevation (m)
                    </Label>
                    <Input
                      id="elevation"
                      type="number"
                      {...register("elevation", { valueAsNumber: true })}
                      className="w-full px-4 py-3 bg-input border-border"
                      placeholder="0"
                      data-testid="input-elevation"
                    />
                  </div>

                  <div>
                    <Label htmlFor="slopeFacing" className="block text-sm font-medium mb-2">
                      Slope Facing (°)
                    </Label>
                    <Input
                      id="slopeFacing"
                      type="number"
                      {...register("slopeFacing", { valueAsNumber: true })}
                      className="w-full px-4 py-3 bg-input border-border"
                      placeholder="0"
                      data-testid="input-slope-facing"
                    />
                  </div>

                  <div>
                    <Label htmlFor="steepness" className="block text-sm font-medium mb-2">
                      Steepness (%)
                    </Label>
                    <Input
                      id="steepness"
                      type="number"
                      {...register("steepness", { valueAsNumber: true })}
                      className="w-full px-4 py-3 bg-input border-border"
                      placeholder="0"
                      data-testid="input-steepness"
                    />
                  </div>

                  <div>
                    <Label htmlFor="rainfall" className="block text-sm font-medium mb-2">
                      Rainfall (mm/yr)
                    </Label>
                    <Input
                      id="rainfall"
                      type="number"
                      {...register("rainfall", { valueAsNumber: true })}
                      className="w-full px-4 py-3 bg-input border-border"
                      placeholder="0"
                      data-testid="input-rainfall"
                    />
                  </div>

                  <div>
                    <Label htmlFor="drainage" className="block text-sm font-medium mb-2">
                      Drainage (m³/yr)
                    </Label>
                    <Input
                      id="drainage"
                      type="number"
                      {...register("drainage", { valueAsNumber: true })}
                      className="w-full px-4 py-3 bg-input border-border"
                      placeholder="5000"
                      data-testid="input-drainage"
                    />
                  </div>
                </div>
              </div>

              {/* Soil Conditions Section */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-semibold text-primary">Soil Conditions</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="block text-sm font-medium mb-2">
                      Salts: {watch("soilSalts") || 50}%
                    </Label>
                    <Slider
                      value={[watch("soilSalts") || 50]}
                      onValueChange={(value) => setValue("soilSalts", value[0])}
                      max={100}
                      step={1}
                      className="w-full"
                      data-testid="slider-soil-salts"
                    />
                  </div>

                  <div>
                    <Label className="block text-sm font-medium mb-2">
                      Nitrogen: {watch("soilNitrogen") || 50}%
                    </Label>
                    <Slider
                      value={[watch("soilNitrogen") || 50]}
                      onValueChange={(value) => setValue("soilNitrogen", value[0])}
                      max={100}
                      step={1}
                      className="w-full"
                      data-testid="slider-soil-nitrogen"
                    />
                  </div>

                  <div>
                    <Label className="block text-sm font-medium mb-2">
                      Microbial Mass: {watch("soilMicrobialMass") || 50}%
                    </Label>
                    <Slider
                      value={[watch("soilMicrobialMass") || 50]}
                      onValueChange={(value) => setValue("soilMicrobialMass", value[0])}
                      max={100}
                      step={1}
                      className="w-full"
                      data-testid="slider-soil-microbial-mass"
                    />
                  </div>

                  <div>
                    <Label className="block text-sm font-medium mb-2">
                      Earthworms: {watch("soilEarthworms") || 50}%
                    </Label>
                    <Slider
                      value={[watch("soilEarthworms") || 50]}
                      onValueChange={(value) => setValue("soilEarthworms", value[0])}
                      max={100}
                      step={1}
                      className="w-full"
                      data-testid="slider-soil-earthworms"
                    />
                  </div>

                  <div>
                    <Label htmlFor="soilAcidity" className="block text-sm font-medium mb-2">
                      Acidity (pH)
                    </Label>
                    <Input
                      id="soilAcidity"
                      type="number"
                      step="0.1"
                      min="0"
                      max="14"
                      {...register("soilAcidity", { valueAsNumber: true })}
                      className="w-full px-4 py-3 bg-input border-border"
                      placeholder="7.0"
                      data-testid="input-soil-acidity"
                    />
                  </div>

                  <div>
                    <Label className="block text-sm font-medium mb-2">
                      Fertility: {watch("soilFertility") || 50}%
                    </Label>
                    <Slider
                      value={[watch("soilFertility") || 50]}
                      onValueChange={(value) => setValue("soilFertility", value[0])}
                      max={100}
                      step={1}
                      className="w-full"
                      data-testid="slider-soil-fertility"
                    />
                  </div>
                </div>
              </div>

              {/* Pests Section */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-semibold text-primary">Pests</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pestBambooBorer"
                      checked={watch("pestBambooBorer") === "true"}
                      onCheckedChange={(checked) => setValue("pestBambooBorer", checked ? "true" : "false")}
                      data-testid="checkbox-pest-bamboo-borer"
                    />
                    <Label htmlFor="pestBambooBorer" className="text-sm">Bamboo Borer</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pestAphids"
                      checked={watch("pestAphids") === "true"}
                      onCheckedChange={(checked) => setValue("pestAphids", checked ? "true" : "false")}
                      data-testid="checkbox-pest-aphids"
                    />
                    <Label htmlFor="pestAphids" className="text-sm">Aphids</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pestFungalPathogens"
                      checked={watch("pestFungalPathogens") === "true"}
                      onCheckedChange={(checked) => setValue("pestFungalPathogens", checked ? "true" : "false")}
                      data-testid="checkbox-pest-fungal-pathogens"
                    />
                    <Label htmlFor="pestFungalPathogens" className="text-sm">Fungal Pathogens</Label>
                  </div>
                </div>
              </div>

              {/* Intervention Section */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-semibold text-primary">Intervention</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="interventionWeeding"
                      checked={watch("interventionWeeding") === "true"}
                      onCheckedChange={(checked) => setValue("interventionWeeding", checked ? "true" : "false")}
                      data-testid="checkbox-intervention-weeding"
                    />
                    <Label htmlFor="interventionWeeding" className="text-sm">Weeding</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="interventionMulching"
                      checked={watch("interventionMulching") === "true"}
                      onCheckedChange={(checked) => setValue("interventionMulching", checked ? "true" : "false")}
                      data-testid="checkbox-intervention-mulching"
                    />
                    <Label htmlFor="interventionMulching" className="text-sm">Mulching</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="interventionFertilization"
                      checked={watch("interventionFertilization") === "true"}
                      onCheckedChange={(checked) => setValue("interventionFertilization", checked ? "true" : "false")}
                      data-testid="checkbox-intervention-fertilization"
                    />
                    <Label htmlFor="interventionFertilization" className="text-sm">Fertilization</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="interventionPestControl"
                      checked={watch("interventionPestControl") === "true"}
                      onCheckedChange={(checked) => setValue("interventionPestControl", checked ? "true" : "false")}
                      data-testid="checkbox-intervention-pest-control"
                    />
                    <Label htmlFor="interventionPestControl" className="text-sm">Pest Control</Label>
                  </div>
                </div>
              </div>

              {/* Intercropping Section */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-semibold text-primary">Intercropping</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="intercroppingLegumes"
                      checked={watch("intercroppingLegumes") === "true"}
                      onCheckedChange={(checked) => setValue("intercroppingLegumes", checked ? "true" : "false")}
                      data-testid="checkbox-intercropping-legumes"
                    />
                    <Label htmlFor="intercroppingLegumes" className="text-sm">Legumes (beans, peas, lentils)</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="intercroppingHerbs"
                      checked={watch("intercroppingHerbs") === "true"}
                      onCheckedChange={(checked) => setValue("intercroppingHerbs", checked ? "true" : "false")}
                      data-testid="checkbox-intercropping-herbs"
                    />
                    <Label htmlFor="intercroppingHerbs" className="text-sm">Herbs (ginger, turmeric)</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="intercroppingSpecialtyCrops"
                      checked={watch("intercroppingSpecialtyCrops") === "true"}
                      onCheckedChange={(checked) => setValue("intercroppingSpecialtyCrops", checked ? "true" : "false")}
                      data-testid="checkbox-intercropping-specialty-crops"
                    />
                    <Label htmlFor="intercroppingSpecialtyCrops" className="text-sm">Specialty Crops (coffee, cacao, tea)</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="intercroppingAnimals"
                      checked={watch("intercroppingAnimals") === "true"}
                      onCheckedChange={(checked) => setValue("intercroppingAnimals", checked ? "true" : "false")}
                      data-testid="checkbox-intercropping-animals"
                    />
                    <Label htmlFor="intercroppingAnimals" className="text-sm">Animals (fowl, pigs)</Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <Button 
                type="submit" 
                disabled={plotMutation.isPending}
                className="px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid={isEditMode ? "button-update-plot" : "button-create-plot"}
              >
                {plotMutation.isPending 
                  ? (isEditMode ? "Updating..." : "Creating...") 
                  : (isEditMode ? "Update Plot" : "Create Plot")
                }
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
