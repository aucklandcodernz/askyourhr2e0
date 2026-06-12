import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sdList, sdCreate, sdUpdate } from '@/lib/secureDataClient';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Plus, ClipboardList } from 'lucide-react';
import { format, addDays } from 'date-fns';

const DEFAULT_EMPLOYEE_TASKS = [
  'Sign employment agreement',
  'Complete personal details form',
  'Upload required documents (ID, visa, bank details)',
  'Read company policies and procedures',
  'Complete site/workplace induction',
  'Complete Health & Safety training',
];

const DEFAULT_MANAGER_TASKS = [
  'Allocate uniform/equipment',
  'Schedule workplace induction',
  'Assign mandatory training',
  'Approve onboarding completion',
];

export default function Onboarding() {
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ['onboardingTasks'],
    queryFn: () => sdList('OnboardingTask'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => sdList('Employee'),
  });

  const createMutation = useMutation({
    mutationFn: async (allTasks) => {
      for (const task of allTasks) {
        await sdCreate('OnboardingTask', task);
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['onboardingTasks'] }); setShowGenerate(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => sdUpdate('OnboardingTask', id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboardingTasks'] }),
  });

  const onboardingEmployees = employees.filter(e => e.status === 'onboarding');

  const getEmployeeName = (id) => {
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown';
  };

  const tasksByEmployee = {};
  tasks.forEach(t => {
    if (!tasksByEmployee[t.employee_id]) tasksByEmployee[t.employee_id] = [];
    tasksByEmployee[t.employee_id].push(t);
  });

  const generateTasks = () => {
    const emp = employees.find(e => e.id === selectedEmployee);
    if (!emp) return;
    const dueDate = format(addDays(new Date(), 14), 'yyyy-MM-dd');
    const allTasks = [
      ...DEFAULT_EMPLOYEE_TASKS.map((title, i) => ({
        employee_id: emp.id, organization_id: emp.organization_id, title, category: 'employee',
        status: 'pending', due_date: dueDate, sort_order: i
      })),
      ...DEFAULT_MANAGER_TASKS.map((title, i) => ({
        employee_id: emp.id, organization_id: emp.organization_id, title, category: 'manager',
        status: 'pending', due_date: dueDate, sort_order: DEFAULT_EMPLOYEE_TASKS.length + i
      })),
    ];
    createMutation.mutate(allTasks);
  };

  const toggleTask = (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateMutation.mutate({
      id: task.id,
      data: { status: newStatus, completed_date: newStatus === 'completed' ? format(new Date(), 'yyyy-MM-dd') : null }
    });
  };

  return (
    <div>
      <PageHeader
        title="Onboarding"
        subtitle={`${onboardingEmployees.length} employee(s) currently onboarding`}
        actions={<Button onClick={() => setShowGenerate(true)}><Plus className="w-4 h-4 mr-2" />Generate Tasks</Button>}
      />

      {Object.keys(tasksByEmployee).length === 0 ? (
        <EmptyState icon={ClipboardList} title="No onboarding tasks" description="Generate onboarding checklist tasks for new employees." action="Generate Tasks" onAction={() => setShowGenerate(true)} />
      ) : (
        <div className="space-y-6">
          {Object.entries(tasksByEmployee).map(([empId, empTasks]) => {
            const completed = empTasks.filter(t => t.status === 'completed').length;
            const total = empTasks.length;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <Card key={empId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-display">{getEmployeeName(empId)}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{completed}/{total} tasks completed</p>
                    </div>
                    <span className="text-sm font-semibold text-primary">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {empTasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(task => (
                      <div key={task.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted transition-colors">
                        <Checkbox checked={task.status === 'completed'} onCheckedChange={() => toggleTask(task)} />
                        <div className="flex-1">
                          <p className={`text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                        </div>
                        <StatusBadge status={task.category} />
                        {task.due_date && <span className="text-xs text-muted-foreground">Due {format(new Date(task.due_date), 'd MMM')}</span>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Generate Onboarding Tasks</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger><SelectValue placeholder="Choose employee" /></SelectTrigger>
                <SelectContent>
                  {onboardingEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Will generate:</p>
              <p>• {DEFAULT_EMPLOYEE_TASKS.length} employee tasks</p>
              <p>• {DEFAULT_MANAGER_TASKS.length} manager tasks</p>
              <p>• Due in 14 days</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
              <Button onClick={generateTasks} disabled={!selectedEmployee || createMutation.isPending}>
                {createMutation.isPending ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}