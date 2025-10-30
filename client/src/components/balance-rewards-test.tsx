import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Activity, Shield, User, Target, Zap, Heart } from 'lucide-react';

interface BalanceRewardsTestProps {
  phoneNumber?: string;
}

export default function BalanceRewardsTest({ phoneNumber }: BalanceRewardsTestProps) {
  const [testPhoneNumber, setTestPhoneNumber] = useState(phoneNumber || '');
  const [activityType, setActivityType] = useState('');
  const [activityData, setActivityData] = useState({
    steps: '',
    distance: '',
    calories: '',
    duration: '',
    weight: '',
    weightUnit: 'lbs',
    exerciseType: '',
    medicationName: '',
    dosage: '',
    checkupType: '',
    result: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [isLoading, setIsLoading] = useState(false);
  const [oauthUrl, setOauthUrl] = useState('');
  const [activities, setActivities] = useState([]);
  const [tokenInfo, setTokenInfo] = useState(null);
  // Toast removed - using console.log instead

  // Initialize OAuth flow
  const handleInitOAuth = async () => {
    if (!testPhoneNumber) {
console.log("Toast removed");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/balance-rewards/oauth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: testPhoneNumber })
      });

      const data = await response.json();
      
      if (data.success) {
        setOauthUrl(data.authUrl);
console.log("Toast removed");
      } else {
        throw new Error(data.message || 'Error inicializando OAuth');
      }
    } catch (error) {
      console.error('OAuth init error:', error);
console.log("Toast removed");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit health activity
  const handleSubmitActivity = async () => {
    if (!testPhoneNumber || !activityType) {
console.log("Toast removed");
      return;
    }

    // Prepare activity data based on type
    const cleanedData = Object.entries(activityData).reduce((acc, [key, value]) => {
      if (value && value !== '') {
        acc[key] = key === 'steps' || key === 'calories' || key === 'duration' || key === 'weight' 
          ? parseFloat(value) 
          : value;
      }
      return acc;
    }, {});

    setIsLoading(true);
    try {
      const response = await fetch('/api/balance-rewards/activity/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: testPhoneNumber,
          activityType,
          activityData: cleanedData
        })
      });

      const data = await response.json();
      
      if (data.success) {
console.log("Toast removed");
        // Refresh activities
        handleGetActivities();
      } else {
        throw new Error(data.message || 'Error enviando actividad');
      }
    } catch (error) {
      console.error('Submit activity error:', error);
console.log("Toast removed");
    } finally {
      setIsLoading(false);
    }
  };

  // Get activities for member
  const handleGetActivities = async () => {
    if (!testPhoneNumber) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/balance-rewards/activities/${testPhoneNumber}`);
      const data = await response.json();
      
      if (data.success) {
        setActivities(data.activities);
      } else {
        throw new Error(data.message || 'Error obteniendo actividades');
      }
    } catch (error) {
      console.error('Get activities error:', error);
console.log("Toast removed");
    } finally {
      setIsLoading(false);
    }
  };

  // Get token info
  const handleGetToken = async () => {
    if (!testPhoneNumber) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/balance-rewards/token/${testPhoneNumber}`);
      const data = await response.json();
      
      if (data.success) {
        setTokenInfo(data.token);
      } else {
        setTokenInfo(null);
console.log("Toast removed");
      }
    } catch (error) {
      console.error('Get token error:', error);
console.log("Toast removed");
    } finally {
      setIsLoading(false);
    }
  };

  const renderActivityFields = () => {
    switch (activityType) {
      case 'walking':
      case 'running':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="steps">Pasos</Label>
                <Input
                  id="steps"
                  type="number"
                  value={activityData.steps}
                  onChange={(e) => setActivityData({...activityData, steps: e.target.value})}
                  placeholder="10000"
                />
              </div>
              <div>
                <Label htmlFor="distance">Distancia (km)</Label>
                <Input
                  id="distance"
                  type="number"
                  step="0.1"
                  value={activityData.distance}
                  onChange={(e) => setActivityData({...activityData, distance: e.target.value})}
                  placeholder="5.2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="calories">Calorías</Label>
                <Input
                  id="calories"
                  type="number"
                  value={activityData.calories}
                  onChange={(e) => setActivityData({...activityData, calories: e.target.value})}
                  placeholder="300"
                />
              </div>
              <div>
                <Label htmlFor="duration">Duración (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={activityData.duration}
                  onChange={(e) => setActivityData({...activityData, duration: e.target.value})}
                  placeholder="30"
                />
              </div>
            </div>
          </>
        );
      
      case 'weight_management':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="weight">Peso</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={activityData.weight}
                onChange={(e) => setActivityData({...activityData, weight: e.target.value})}
                placeholder="70.5"
              />
            </div>
            <div>
              <Label htmlFor="weightUnit">Unidad</Label>
              <Select value={activityData.weightUnit} onValueChange={(value) => setActivityData({...activityData, weightUnit: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lbs">Libras</SelectItem>
                  <SelectItem value="kg">Kilogramos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      
      case 'exercise':
        return (
          <div>
            <Label htmlFor="exerciseType">Tipo de Ejercicio</Label>
            <Input
              id="exerciseType"
              value={activityData.exerciseType}
              onChange={(e) => setActivityData({...activityData, exerciseType: e.target.value})}
              placeholder="Yoga, Ciclismo, Natación..."
            />
          </div>
        );
      
      case 'medication':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="medicationName">Medicamento</Label>
              <Input
                id="medicationName"
                value={activityData.medicationName}
                onChange={(e) => setActivityData({...activityData, medicationName: e.target.value})}
                placeholder="Nombre del medicamento"
              />
            </div>
            <div>
              <Label htmlFor="dosage">Dosis</Label>
              <Input
                id="dosage"
                value={activityData.dosage}
                onChange={(e) => setActivityData({...activityData, dosage: e.target.value})}
                placeholder="50mg, 2 veces al día"
              />
            </div>
          </div>
        );
      
      case 'health_check':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="checkupType">Tipo de Chequeo</Label>
              <Input
                id="checkupType"
                value={activityData.checkupType}
                onChange={(e) => setActivityData({...activityData, checkupType: e.target.value})}
                placeholder="Presión arterial, Glucosa..."
              />
            </div>
            <div>
              <Label htmlFor="result">Resultado</Label>
              <Input
                id="result"
                value={activityData.result}
                onChange={(e) => setActivityData({...activityData, result: e.target.value})}
                placeholder="120/80, 95 mg/dL..."
              />
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'walking':
      case 'running':
        return <Activity className="w-4 h-4" />;
      case 'weight_management':
        return <Target className="w-4 h-4" />;
      case 'exercise':
        return <Zap className="w-4 h-4" />;
      case 'medication':
        return <Shield className="w-4 h-4" />;
      case 'health_check':
        return <Heart className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <User className="w-6 h-6 text-red-600" />
        <h1 className="text-2xl font-bold">Balance Rewards API Testing</h1>
      </div>

      {/* Phone Number Input */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Prueba</CardTitle>
          <CardDescription>Ingresa el número de teléfono del miembro para probar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phoneNumber">Número de Teléfono</Label>
              <Input
                id="phoneNumber"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
                placeholder="7866302522"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleGetToken}
                disabled={isLoading || !testPhoneNumber}
                variant="outline"
              >
                Verificar Token OAuth
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OAuth Section */}
      <Card>
        <CardHeader>
          <CardTitle>OAuth Authorization</CardTitle>
          <CardDescription>Inicializa el flujo OAuth para acceder a Balance Rewards API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleInitOAuth}
            disabled={isLoading || !testPhoneNumber}
            className="w-full"
          >
            {isLoading ? 'Iniciando OAuth...' : 'Iniciar OAuth Flow'}
          </Button>
          
          {oauthUrl && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <Label>URL de Autorización:</Label>
              <Textarea
                value={oauthUrl}
                readOnly
                className="mt-2"
                rows={3}
              />
              <Button 
                onClick={() => window.open(oauthUrl, '_blank')}
                className="mt-2"
                variant="outline"
              >
                Abrir en Nueva Pestaña
              </Button>
            </div>
          )}

          {tokenInfo && (
            <div className="p-4 bg-green-50 rounded-lg">
              <Label>Información del Token:</Label>
              <pre className="mt-2 text-sm bg-white p-2 rounded border">
                {JSON.stringify(tokenInfo, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Submission */}
      <Card>
        <CardHeader>
          <CardTitle>Enviar Actividad de Salud</CardTitle>
          <CardDescription>Envía datos de actividad física o salud para ganar puntos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="activityType">Tipo de Actividad</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo de actividad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walking">Caminar</SelectItem>
                  <SelectItem value="running">Correr</SelectItem>
                  <SelectItem value="weight_management">Control de Peso</SelectItem>
                  <SelectItem value="exercise">Ejercicio</SelectItem>
                  <SelectItem value="medication">Medicamento</SelectItem>
                  <SelectItem value="health_check">Chequeo Médico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={activityData.date}
                onChange={(e) => setActivityData({...activityData, date: e.target.value})}
              />
            </div>
          </div>

          {renderActivityFields()}

          <Button 
            onClick={handleSubmitActivity}
            disabled={isLoading || !testPhoneNumber || !activityType}
            className="w-full"
          >
            {isLoading ? 'Enviando...' : 'Enviar Actividad'}
          </Button>
        </CardContent>
      </Card>

      {/* Activities List */}
      <Card>
        <CardHeader>
          <CardTitle>Actividades Registradas</CardTitle>
          <CardDescription>Historial de actividades enviadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button 
              onClick={handleGetActivities}
              disabled={isLoading || !testPhoneNumber}
              variant="outline"
            >
              Cargar Actividades
            </Button>
          </div>

          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getActivityIcon(activity.activityType)}
                      <span className="font-medium">{activity.activityType}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        activity.status === 'rewarded' ? 'bg-green-100 text-green-800' :
                        activity.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                        activity.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {activity.status}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(activity.createdAt).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="text-sm">
                    <strong>Puntos:</strong> {activity.pointsAwarded || 0}
                  </div>
                  
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-blue-600">Ver detalles</summary>
                    <pre className="mt-2 text-xs bg-gray-50 p-2 rounded">
                      {JSON.stringify(activity.activityData, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No se encontraron actividades registradas.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}