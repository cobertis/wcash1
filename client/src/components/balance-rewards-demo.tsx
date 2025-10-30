import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Activity, Trophy, Heart } from 'lucide-react';

export default function BalanceRewardsDemo() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [activityType, setActivityType] = useState('');
  const [activityData, setActivityData] = useState({
    steps: '',
    distance: '',
    duration: '',
    weight: '',
    exerciseType: '',
    calories: ''
  });
  const [testResult, setTestResult] = useState(null);
  const [authUrl, setAuthUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthCode, setOauthCode] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [activityResult, setActivityResult] = useState(null);
  const [pointsResult, setPointsResult] = useState(null);

  // Test API connection
  const testConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/balance-rewards/test');
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Generate OAuth URL
  const generateOAuthUrl = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/balance-rewards/auth-url?state=demo_test');
      const result = await response.json();
      setAuthUrl(result.authUrl);
    } catch (error) {
      console.error('Error generating OAuth URL:', error);
    } finally {
      setLoading(false);
    }
  };

  // Exchange OAuth code for token
  const exchangeToken = async () => {
    if (!oauthCode) return;
    setLoading(true);
    try {
      const response = await fetch('/api/balance-rewards/token/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: oauthCode,
          state: 'demo_test',
          transactionId: Date.now().toString()
        })
      });
      const result = await response.json();
      if (result.access_token) {
        setAccessToken(result.access_token);
      }
    } catch (error) {
      console.error('Token exchange error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Submit activity
  const submitActivity = async () => {
    if (!phoneNumber || !activityType) return;
    setLoading(true);
    try {
      const response = await fetch('/api/balance-rewards/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberPhone: phoneNumber,
          accessToken: accessToken || 'demo_token',
          activityData: {
            activityType,
            activityData
          }
        })
      });
      const result = await response.json();
      setActivityResult(result);
    } catch (error) {
      setActivityResult({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Get points total
  const getPointsTotal = async () => {
    if (!phoneNumber) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/balance-rewards/points/${phoneNumber}`);
      const result = await response.json();
      setPointsResult(result);
    } catch (error) {
      setPointsResult({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-red-600">Balance Rewards API Demo</h1>
        <p className="text-gray-600">Prueba el sistema de desafíos de actividad física de 4 semanas</p>
      </div>

      {/* Test Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            1. Prueba de Conexión API
          </CardTitle>
          <CardDescription>
            Verifica que el sistema puede conectarse a la API de Balance Rewards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={testConnection} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Probar Conexión
          </Button>
          
          {testResult && (
            <Card className={`border-2 ${testResult.success ? 'border-green-200' : 'border-red-200'}`}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  {testResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <Badge variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? "Éxito" : "Error"}
                  </Badge>
                </div>
                <p className="text-sm">{testResult.message}</p>
                {testResult.data && (
                  <Textarea
                    value={JSON.stringify(testResult.data, null, 2)}
                    readOnly
                    className="mt-2 h-32"
                  />
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* OAuth Flow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            2. Flujo de Autorización OAuth
          </CardTitle>
          <CardDescription>
            Genera URL de autorización para autenticación con Walgreens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={generateOAuthUrl} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Generar URL OAuth
          </Button>
          
          {authUrl && (
            <Card className="border-2 border-blue-200">
              <CardContent className="pt-4">
                <Label>URL de Autorización:</Label>
                <Textarea value={authUrl} readOnly className="mt-2 h-20" />
                <Button 
                  onClick={() => window.open(authUrl, '_blank')} 
                  className="mt-2 w-full"
                  variant="outline"
                >
                  Abrir en Nueva Ventana
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Código de Autorización (del callback):</Label>
              <Input
                value={oauthCode}
                onChange={(e) => setOauthCode(e.target.value)}
                placeholder="Pegar código aquí"
              />
            </div>
            <div>
              <Label>Token de Acceso:</Label>
              <Input
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Se llenará automáticamente"
              />
            </div>
          </div>
          
          <Button onClick={exchangeToken} disabled={loading || !oauthCode} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Intercambiar por Token
          </Button>
        </CardContent>
      </Card>

      {/* Activity Submission */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            3. Envío de Actividad Física
          </CardTitle>
          <CardDescription>
            Envía datos de actividad para desafíos de 4 semanas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Número de Teléfono:</Label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Ej: 7866302522"
              />
            </div>
            <div>
              <Label>Tipo de Actividad:</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar actividad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walking">Caminar</SelectItem>
                  <SelectItem value="running">Correr</SelectItem>
                  <SelectItem value="biking">Ciclismo</SelectItem>
                  <SelectItem value="steps">Pasos Totales</SelectItem>
                  <SelectItem value="exercise">Ejercicio General</SelectItem>
                  <SelectItem value="weight_management">Peso</SelectItem>
                  <SelectItem value="blood_pressure">Presión Arterial</SelectItem>
                  <SelectItem value="blood_glucose">Glucosa</SelectItem>
                  <SelectItem value="sleep">Sueño</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Pasos:</Label>
              <Input
                value={activityData.steps}
                onChange={(e) => setActivityData({...activityData, steps: e.target.value})}
                placeholder="5000"
              />
            </div>
            <div>
              <Label>Distancia (millas):</Label>
              <Input
                value={activityData.distance}
                onChange={(e) => setActivityData({...activityData, distance: e.target.value})}
                placeholder="2.5"
              />
            </div>
            <div>
              <Label>Duración (segundos):</Label>
              <Input
                value={activityData.duration}
                onChange={(e) => setActivityData({...activityData, duration: e.target.value})}
                placeholder="1800"
              />
            </div>
            <div>
              <Label>Peso (libras):</Label>
              <Input
                value={activityData.weight}
                onChange={(e) => setActivityData({...activityData, weight: e.target.value})}
                placeholder="170"
              />
            </div>
          </div>

          <Button onClick={submitActivity} disabled={loading || !phoneNumber || !activityType} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enviar Actividad
          </Button>

          {activityResult && (
            <Card className={`border-2 ${activityResult.success ? 'border-green-200' : 'border-red-200'}`}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  {activityResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <Badge variant={activityResult.success ? "default" : "destructive"}>
                    {activityResult.success ? "Enviado" : "Error"}
                  </Badge>
                </div>
                <Textarea
                  value={JSON.stringify(activityResult, null, 2)}
                  readOnly
                  className="h-32"
                />
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Points Total */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            4. Consulta de Puntos
          </CardTitle>
          <CardDescription>
            Consulta el total de puntos Balance Rewards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={getPointsTotal} disabled={loading || !phoneNumber} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Consultar Puntos
          </Button>

          {pointsResult && (
            <Card className={`border-2 ${pointsResult.success ? 'border-green-200' : 'border-red-200'}`}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  {pointsResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <Badge variant={pointsResult.success ? "default" : "destructive"}>
                    {pointsResult.success ? "Éxito" : "Error"}
                  </Badge>
                </div>
                <Textarea
                  value={JSON.stringify(pointsResult, null, 2)}
                  readOnly
                  className="h-32"
                />
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-700">Información del Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Desafíos de 4 semanas:</strong> 100 puntos por semana completada</p>
          <p><strong>Máximo por desafío:</strong> 400 puntos</p>
          <p><strong>Bonificación:</strong> Ruleta de hasta 2000 puntos al completar 4 semanas</p>
          <p><strong>Conexión de dispositivos:</strong> 250 puntos por app/dispositivo (máximo 2 al mes)</p>
          <p><strong>Ambiente:</strong> QA (sandbox) - services-qa.walgreens.com</p>
        </CardContent>
      </Card>
    </div>
  );
}