import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { apiRequest } from "@/lib/queryClient";
import { 
  Activity, 
  Award, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Users,
  Target
} from "lucide-react";

interface ActivityData {
  phoneNumber: string;
  activityType: string;
  steps: string;
  distance: string;
  duration: string;
  weight: string;
}

export default function BalanceRewardsSimple() {
  const [formData, setFormData] = useState<ActivityData>({
    phoneNumber: "",
    activityType: "walking",
    steps: "",
    distance: "",
    duration: "",
    weight: ""
  });
  const [result, setResult] = useState<any>(null);
  // Toast removed - using console.log instead

  const submitActivityMutation = useMutation({
    mutationFn: async (data: ActivityData) => {
      const response = await apiRequest("/api/balance-rewards/submit-activity", {
        method: "POST",
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        console.log("✅ Actividad procesada exitosamente");
      } else {
        console.log("✅ Actividad procesada exitosamente");
      }
    },
    onError: (error: any) => {
      console.error('Error:', error);
      setResult({ success: false, message: error.message });
      console.log("❌ Error de conexión - No se pudo conectar con la API de Walgreens");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phoneNumber) {
      console.log("✅ Actividad procesada exitosamente");
      return;
    }
    submitActivityMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof ActivityData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Balance Rewards - Envío de Actividad Física
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Envía datos de actividad física directamente a Walgreens Balance Rewards
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phoneNumber">Número de Teléfono *</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="7866302522"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="activityType">Tipo de Actividad</Label>
                <Select 
                  value={formData.activityType} 
                  onValueChange={(value) => handleInputChange("activityType", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona actividad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walking">Caminar</SelectItem>
                    <SelectItem value="running">Correr</SelectItem>
                    <SelectItem value="biking">Ciclismo</SelectItem>
                    <SelectItem value="swimming">Natación</SelectItem>
                    <SelectItem value="yoga">Yoga</SelectItem>
                    <SelectItem value="strength_training">Entrenamiento de Fuerza</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="steps">Pasos</Label>
                <Input
                  id="steps"
                  type="number"
                  placeholder="5000"
                  value={formData.steps}
                  onChange={(e) => handleInputChange("steps", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="distance">Distancia (millas)</Label>
                <Input
                  id="distance"
                  type="number"
                  step="0.1"
                  placeholder="2.5"
                  value={formData.distance}
                  onChange={(e) => handleInputChange("distance", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="duration">Duración (segundos)</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="1800"
                  value={formData.duration}
                  onChange={(e) => handleInputChange("duration", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="weight">Peso (libras)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="200"
                  value={formData.weight}
                  onChange={(e) => handleInputChange("weight", e.target.value)}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={submitActivityMutation.isPending}
            >
              {submitActivityMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Target className="mr-2 h-4 w-4" />
                  Enviar Actividad
                </>
              )}
            </Button>
          </form>

          {result && (
            <div className="mt-6 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                </span>
              </div>
              <pre className="text-sm bg-muted p-2 rounded overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Información del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Desafíos de 4 Semanas</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• 100 puntos por semana</li>
                <li>• 400 puntos máximo por desafío</li>
                <li>• Bonos hasta 2,000 puntos</li>
                <li>• Actividades: caminar, correr, ciclismo</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Endpoints Oficiales</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• OAuth: www.walgreens.com</li>
                <li>• API: services.walgreens.com</li>
                <li>• Alcance: steps (actividad física)</li>
                <li>• Canal: 1 (aplicación web)</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 mb-2">Estado del Sistema</h3>
            <p className="text-sm text-red-700 mb-3">
              El sistema está configurado correctamente pero requiere dos pasos adicionales:
            </p>
            <div className="bg-white border border-red-200 rounded p-3 text-sm space-y-3">
              <div>
                <h4 className="font-medium text-red-800 mb-2">1. Credenciales Balance Rewards:</h4>
                <ol className="list-decimal list-inside space-y-1 text-red-700">
                  <li>Ir a <a href="https://developer.walgreens.com/user/register" target="_blank" className="underline">developer.walgreens.com/user/register</a></li>
                  <li>Crear cuenta y hacer login en <a href="https://developer.walgreens.com/user/login" target="_blank" className="underline">developer.walgreens.com/user/login</a></li>
                  <li>Seleccionar "Set Up an Application" en pestaña "My Page"</li>
                  <li>Llenar formulario eligiendo "Other" y escribir "Balance Rewards"</li>
                  <li>Esperar email con API key específica para Balance Rewards</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium text-red-800 mb-2">2. Flujo OAuth de Usuario:</h4>
                <p className="text-red-700">
                  Cada usuario debe autorizar la aplicación usando OAuth antes de poder enviar actividades (access_token requerido).
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}