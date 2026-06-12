import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sdUpdate } from '@/lib/secureDataClient';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Building2, CreditCard, Shield, Edit } from 'lucide-react';
import { format } from 'date-fns';
import EmployeeForm from './EmployeeForm';

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function EmployeeDetail({ employee, onBack, organizations }) {
  const [showEdit, setShowEdit] = useState(false);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => sdUpdate('Employee', employee.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowEdit(false);
      onBack();
    },
  });

  const orgName = organizations?.find(o => o.id === employee.organization_id)?.name;

  return (
    <div>
      <PageHeader
        title={`${employee.first_name} ${employee.last_name}`}
        subtitle={employee.position}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
            <Button onClick={() => setShowEdit(true)}><Edit className="w-4 h-4 mr-2" />Edit</Button>
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="text-xl font-bold text-primary">{employee.first_name?.[0]}{employee.last_name?.[0]}</span>
        </div>
        <div>
          <StatusBadge status={employee.status} />
          <p className="text-sm text-muted-foreground mt-1">{orgName}</p>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm font-display">Personal Information</CardTitle></CardHeader>
              <CardContent>
                <InfoRow icon={Mail} label="Email" value={employee.email} />
                <InfoRow icon={Phone} label="Phone" value={employee.phone} />
                <InfoRow icon={MapPin} label="Address" value={employee.address} />
                <InfoRow icon={Calendar} label="Date of Birth" value={employee.date_of_birth ? format(new Date(employee.date_of_birth), 'd MMM yyyy') : null} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-display">Emergency Contact</CardTitle></CardHeader>
              <CardContent>
                <InfoRow icon={Phone} label="Name" value={employee.emergency_contact_name} />
                <InfoRow icon={Phone} label="Phone" value={employee.emergency_contact_phone} />
                <InfoRow icon={Phone} label="Relationship" value={employee.emergency_contact_relationship} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employment">
          <Card>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-x-8">
                <InfoRow icon={Building2} label="Organisation" value={orgName} />
                <InfoRow icon={Building2} label="Position" value={employee.position} />
                <InfoRow icon={Building2} label="Department" value={employee.department} />
                <InfoRow icon={Building2} label="Employment Type" value={employee.employment_type?.replace('_', ' ')} />
                <InfoRow icon={Calendar} label="Start Date" value={employee.start_date ? format(new Date(employee.start_date), 'd MMM yyyy') : null} />
                <InfoRow icon={Shield} label="Visa Type" value={employee.visa_type} />
                <InfoRow icon={Calendar} label="Visa Expiry" value={employee.visa_expiry ? format(new Date(employee.visa_expiry), 'd MMM yyyy') : null} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-x-8">
                <InfoRow icon={CreditCard} label="Bank Account" value={employee.bank_account_number} />
                <InfoRow icon={CreditCard} label="Account Name" value={employee.bank_account_name} />
                <InfoRow icon={CreditCard} label="IRD Number" value={employee.ird_number} />
                <InfoRow icon={CreditCard} label="Tax Code" value={employee.tax_code} />
                <InfoRow icon={CreditCard} label="KiwiSaver Rate" value={employee.kiwisaver_rate ? `${employee.kiwisaver_rate}%` : null} />
                <InfoRow icon={CreditCard} label="Hourly Rate" value={employee.hourly_rate ? `$${employee.hourly_rate}` : null} />
                <InfoRow icon={CreditCard} label="Salary" value={employee.salary ? `$${employee.salary.toLocaleString()}` : null} />
                <InfoRow icon={CreditCard} label="Pay Frequency" value={employee.pay_frequency} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="pt-6">
              {employee.documents?.length > 0 ? (
                <div className="space-y-2">
                  {employee.documents.map((doc, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium flex-1">{doc.name}</p>
                      <StatusBadge status={doc.type} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No documents uploaded yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Edit Employee</DialogTitle></DialogHeader>
          <EmployeeForm organizations={organizations} onSubmit={(data) => updateMutation.mutate(data)} isLoading={updateMutation.isPending} initialData={employee} />
        </DialogContent>
      </Dialog>
    </div>
  );
}