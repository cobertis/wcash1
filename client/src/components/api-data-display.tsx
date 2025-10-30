import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ApiDataDisplayProps {
  lookupData: any;
  memberData: any;
  encLoyaltyId: string;
}

export default function ApiDataDisplay({ lookupData, memberData, encLoyaltyId }: ApiDataDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    lookup: false,
    member: true,
    preferences: false,
    programs: false,
    raw: false,
  });
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  // Toast removed - using console.log instead

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const copyToClipboard = async (data: any, sectionName: string) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedSection(sectionName);
      console.log(`Toast removed: Datos de ${sectionName} copiados al portapapeles`);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (error) {
      console.log("Toast removed: No se pudo copiar al portapapeles");
    }
  };

  const renderJsonValue = (value: any, key: string = ""): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400">null</span>;
    }

    if (typeof value === "boolean") {
      return <span className="text-blue-600">{value.toString()}</span>;
    }

    if (typeof value === "number") {
      return <span className="text-green-600">{value}</span>;
    }

    if (typeof value === "string") {
      return <span className="text-red-600">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-400">[]</span>;
      }
      return (
        <div className="ml-4">
          <span className="text-gray-600">[</span>
          {value.map((item, index) => (
            <div key={index} className="ml-4">
              <span className="text-gray-500">{index}:</span> {renderJsonValue(item)}
              {index < value.length - 1 && <span className="text-gray-600">,</span>}
            </div>
          ))}
          <span className="text-gray-600">]</span>
        </div>
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className="text-gray-400">{"{}"}</span>;
      }
      return (
        <div className="ml-4">
          <span className="text-gray-600">{"{"}</span>
          {entries.map(([k, v], index) => (
            <div key={k} className="ml-4">
              <span className="text-purple-600">"{k}"</span>
              <span className="text-gray-600">: </span>
              {renderJsonValue(v, k)}
              {index < entries.length - 1 && <span className="text-gray-600">,</span>}
            </div>
          ))}
          <span className="text-gray-600">{"}"}</span>
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  };

  const profileData = memberData?.profile || {};
  const rewardData = profileData?.Reward || {};
  const nameData = profileData?.Name || {};
  const emailData = profileData?.EMailAddress || {};
  const phoneData = profileData?.PhoneList?.Phone?.[0] || {};
  const preferencesData = profileData?.Preferences || {};
  const pointsExpiration = profileData?.PointsExpirations?.[0] || {};
  const programEnrollments = profileData?.ProgramEnrollments || [];

  return (
    <div className="space-y-6">
      {/* Información Principal del Miembro */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">PERFIL</Badge>
              Información Principal del Miembro
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(memberData, "member")}
              >
                {copiedSection === "member" ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection("member")}
              >
                {expandedSections.member ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {expandedSections.member && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">👤 Nombre Completo</h4>
                <p className="text-sm text-blue-800">{`${nameData.FirstName || ''} ${nameData.LastName || ''}`.trim() || 'N/A'}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">💳 Número de Tarjeta</h4>
                <p className="text-sm text-green-800 font-mono">{profileData.CardNumber || 'N/A'}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 mb-2">💰 Balance W Cash</h4>
                <p className="text-sm text-purple-800 font-bold">${rewardData.CurrentBalanceDollars || '0.00'}</p>
                <p className="text-xs text-purple-600">{rewardData.CurrentBalance || '0'} puntos</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-orange-50 rounded-lg p-4">
                <h4 className="font-medium text-orange-900 mb-2">📧 Email</h4>
                <p className="text-sm text-orange-800">{emailData.EMailAddress || 'N/A'}</p>
              </div>
              <div className="bg-cyan-50 rounded-lg p-4">
                <h4 className="font-medium text-cyan-900 mb-2">📱 Teléfono</h4>
                <p className="text-sm text-cyan-800">{phoneData.AreaCode ? `(${phoneData.AreaCode}) ${phoneData.Number}` : 'N/A'}</p>
                <p className="text-xs text-cyan-600">{phoneData.TypeCode || ''}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="font-medium text-red-900 mb-2">⏳ Expiración de Puntos</h4>
                <p className="text-sm text-red-800">{pointsExpiration.ExpiresOn ? new Date(pointsExpiration.ExpiresOn).toLocaleDateString() : 'N/A'}</p>
                <p className="text-xs text-red-600">{pointsExpiration.Points || '0'} puntos (${pointsExpiration.Dollars || '0.00'})</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <h4 className="font-medium text-yellow-900 mb-2">🎯 Prescripciones para Recompensa</h4>
                <p className="text-sm text-yellow-800">{rewardData.RxThreshold?.ScriptsTo || 'N/A'} prescripciones</p>
                <p className="text-xs text-yellow-600">Gana ${rewardData.RxThreshold?.DollarsAwarded || '0.00'} al completar</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">🏪 Información de Loyalty ID</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Loyalty ID Encriptado:</p>
                  <p className="text-sm text-gray-800 font-mono break-all">{encLoyaltyId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Teléfono Consultado:</p>
                  <p className="text-sm text-gray-800">{formatPhoneNumber(lookupData?.phoneNumber || '')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Preferencias y Configuración */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">PREFERENCIAS</Badge>
              Configuración de Cuenta
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(preferencesData, "preferences")}
              >
                {copiedSection === "preferences" ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection("preferences")}
              >
                {expandedSections.preferences ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {expandedSections.preferences && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">📧 Consentimiento Email</h4>
                <p className="text-sm text-gray-600">{preferencesData.EMailConsentInd ? 'Sí' : 'No'}</p>
                <p className="text-xs text-gray-500">Estado: {preferencesData.EMailValidStatus || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">📱 Consentimiento SMS</h4>
                <p className="text-sm text-gray-600">{preferencesData.SmsMktConsentInd ? 'Sí' : 'No disponible'}</p>
                <p className="text-xs text-gray-500">Estado: {preferencesData.SmsValidStatus || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">🧾 Recibos Digitales</h4>
                <p className="text-sm text-gray-600">{preferencesData.DigitalReceiptInd || 'PAPER'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">🚫 No Llamar</h4>
                <p className="text-sm text-gray-600">{preferencesData.DoNotCallInd ? 'Sí' : 'No'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">✉️ No Enviar Correo</h4>
                <p className="text-sm text-gray-600">{preferencesData.DoNotMailInd ? 'Sí' : 'No'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">🔞 Mayor de Edad</h4>
                <p className="text-sm text-gray-600">{preferencesData.MinAgeInd ? 'Sí' : 'No'}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Programas Activos */}
      {programEnrollments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Badge variant="default">PROGRAMAS</Badge>
                Programas y Ofertas Activas ({programEnrollments.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(programEnrollments, "programs")}
                >
                  {copiedSection === "programs" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection("programs")}
                >
                  {expandedSections.programs ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          {expandedSections.programs && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {programEnrollments.map((program: any, index: number) => (
                  <div key={index} className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-blue-900">{program.Name}</h4>
                      <Badge variant="secondary" className="text-xs">{program.Type}</Badge>
                    </div>
                    <p className="text-sm text-blue-800 mb-2">{program.ProgramHeadline}</p>
                    <p className="text-xs text-blue-600 mb-2">{program.ProgramSecondLine}</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>📅 Válido hasta: {program.EffectiveEndDate ? new Date(program.EffectiveEndDate).toLocaleDateString() : 'N/A'}</p>
                      {program.LastOptInDate && (
                        <p>✅ Inscrito: {new Date(program.LastOptInDate).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Información de Lookup Original */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">LOOKUP</Badge>
              Información de Búsqueda Original
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(lookupData, "lookup")}
              >
                {copiedSection === "lookup" ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection("lookup")}
              >
                {expandedSections.lookup ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {expandedSections.lookup && (
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">📞 Respuesta de Lookup</h4>
              <div className="text-sm font-mono bg-white p-4 rounded border overflow-x-auto max-h-64">
                {renderJsonValue(lookupData)}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Datos Raw de la API */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Badge variant="destructive">RAW DATA</Badge>
              Datos Brutos Completos de la API
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard({ lookup: lookupData, member: memberData }, "raw")}
              >
                {copiedSection === "raw" ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection("raw")}
              >
                {expandedSections.raw ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {expandedSections.raw && (
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-mono bg-white p-4 rounded border overflow-x-auto max-h-96">
                <pre>{JSON.stringify({ lookup: lookupData, member: memberData }, null, 2)}</pre>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}