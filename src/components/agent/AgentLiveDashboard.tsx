// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useDataState } from "@/contexts/DataContext";
import { LoanRecord, CustomerFeedback, db } from "@/lib/db";
import { format, isToday, parseISO, formatDistanceToNow } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AgentLiveDetailsSheet } from "./AgentLiveDetailsSheet";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Link } from '@/lib/router-compat';
import { MessageSquare, IndianRupee as Rupee, UserCheck, Users, Clock, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AgentLiveDashboard() {
    const { user } = useAuth();
    const { records } = useDataState();
    const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([]);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetTitle, setSheetTitle] = useState("");
    
  const [sheetCustomers, setSheetCustomers] = useState<LoanRecord[]>([]);

  // Attendance logic
  const [attendanceRecord, setAttendanceRecord] = useState<Record<string, unknown>>(null);
  const [isPunching, setIsPunching] = useState(false);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    db.attendance_logs.where({ userId: user.id, date: today }).first().then(record => {
      setAttendanceRecord(record || null);
    });
  }, [user]);

  const handlePunchIn = async () => {
    if (!user) return;
    setIsPunching(true);
    const today = new Date().toISOString().slice(0, 10);
    const id = crypto.randomUUID();
    const newRecord = {
      id,
      userId: user.id,
      userName: user.name,
      date: today,
      loginTime: new Date().toISOString(),
      breakDuration: 0
    };
    await db.attendance_logs.add(newRecord);
    setAttendanceRecord(newRecord);
    setIsPunching(false);
    toast.success('Punched in successfully!');
  };

  const handlePunchOut = async () => {
    if (!attendanceRecord) return;
    setIsPunching(true);
    const updated = { ...attendanceRecord, logoutTime: new Date().toISOString() };
    await db.attendance_logs.put(updated);
    setAttendanceRecord(updated);
    setIsPunching(false);
    toast.success('Punched out successfully!');
  };

  const handleBreakStart = async () => {
    if (!attendanceRecord) return;
    setIsPunching(true);
    const updated = { ...attendanceRecord, currentBreakStart: new Date().toISOString() };
    await db.attendance_logs.put(updated);
    setAttendanceRecord(updated);
    setIsPunching(false);
    toast.success('Break started');
  };

  const handleBreakEnd = async () => {
    if (!attendanceRecord || !attendanceRecord.currentBreakStart) return;
    setIsPunching(true);
    const endTime = new Date();
    const startTime = parseISO(attendanceRecord.currentBreakStart);
    const breakMins = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    const updated = { 
        ...attendanceRecord, 
        breakDuration: (attendanceRecord.breakDuration || 0) + breakMins
    };
    delete updated.currentBreakStart;
    
    await db.attendance_logs.put(updated);
    setAttendanceRecord(updated);
    setIsPunching(false);
    toast.success('Break ended');
  };



    useEffect(() => {
        if (user) {
            db.customer_feedbacks.where('agentId').equals(user.id).toArray().then(fbs => {
                setFeedbacks(fbs);
            });
        }
    }, [user]);

    const handleCardClick = (title: string, customers: LoanRecord[]) => {
        setSheetTitle(title);
        setSheetCustomers(customers);
        setSheetOpen(true);
    };

    if (user?.role !== 'EXECUTIVE') {
        return null;
    }

    const getCustomerName = (agreementid: string) => {
        return records.find(r => r.AGREEMENTID === agreementid)?.CUSTOMERNAME || agreementid;
    };

    const getCustomersFromFeedback = (fbs: CustomerFeedback[]) => {
        const ids = Array.from(new Set(fbs.map(f => f.agreementid)));
        return records.filter(r => ids.includes(r.AGREEMENTID));
    };

    const myRecords = records.filter(r => r.AGENT === user?.name || r.AGENT === user?.id);

    const feedbackToday = feedbacks.filter(f => isToday(parseISO(f.createdAt)));

    const ptpFeedbacks = feedbacks.filter(f => f.status === 'PTP');
    const ptpAgreementIds = Array.from(new Set(ptpFeedbacks.map(f => f.agreementid)));
    const uniquePtpCustomers = records.filter(r => ptpAgreementIds.includes(r.AGREEMENTID));
    const totalPTP = uniquePtpCustomers.reduce((sum, r) => sum + (r.POS || 0), 0);

    const paidFeedbacks = feedbacks.filter(f => f.status === 'Paid');
    const paidAgreementIds = Array.from(new Set(paidFeedbacks.map(f => f.agreementid)));
    const uniquePaidCustomers = records.filter(r => paidAgreementIds.includes(r.AGREEMENTID));
    const totalPaid = uniquePaidCustomers.reduce((sum, r) => sum + (r.POS || 0), 0);

    const contactedAgreementIds = Array.from(new Set(feedbacks.map(f => f.agreementid)));
    const notContactedCustomers = myRecords.filter(r => !contactedAgreementIds.includes(r.AGREEMENTID));

    const statusCounts = feedbacks.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const feedbackStatusData = Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value,
        fill: `var(--color-${name.toLowerCase().replace(/[^a-z0-9]/g, '')})`
    }));

    const chartConfig = {
        value: { label: "Count" },
        ...Object.keys(statusCounts).reduce((acc, status, index) => {
            const colors = ['#0D74B5', '#55A94F', '#EFC51E', '#E33E32', '#81258C', '#EF8424', '#64748B'];
            acc[status.toLowerCase().replace(/[^a-z0-9]/g, '')] = {
                label: status,
                color: colors[index % colors.length]
            };
            return acc;
        }, {} as Record<string, unknown>)
    };

    const recentActivities = [...feedbacks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  return (
    <div className="space-y-6">
      
      {/* Attendance Card */}
      <div className="mb-6">
        <Card className={attendanceRecord && !attendanceRecord.logoutTime ? "border-primary/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="flex justify-between items-center text-base font-semibold">
              <span>Today&apos;s Attendance</span>
              {attendanceRecord?.logoutTime ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Shift Completed
                </span>
              ) : attendanceRecord?.currentBreakStart ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5" /> On Break
                </span>
              ) : attendanceRecord?.loginTime ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active Shift
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground flex items-center gap-2 font-tabular">
                <Clock className="w-4 h-4 shrink-0" />
                {attendanceRecord?.loginTime ? (
                   <span>Punched in at: <strong className="text-foreground">{new Date(attendanceRecord.loginTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong></span>
                ) : (
                   <span>You haven&apos;t punched in yet today.</span>
                )}
                {attendanceRecord?.logoutTime && (
                   <span className="ml-2">| Punched out at: <strong className="text-foreground">{new Date(attendanceRecord.logoutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong></span>
                )}
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto">
                {!attendanceRecord ? (
                  <Button onClick={handlePunchIn} disabled={isPunching} className="w-full sm:w-auto">Punch In</Button>
                ) : !attendanceRecord.logoutTime ? (
                  <>
                    {!attendanceRecord.currentBreakStart ? (
                        <Button onClick={handleBreakStart} disabled={isPunching} variant="secondary" className="w-full sm:w-auto">Start Break</Button>
                    ) : (
                        <Button onClick={handleBreakEnd} disabled={isPunching} variant="default" className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto">End Break</Button>
                    )}
                    <Button onClick={handlePunchOut} disabled={isPunching} variant="destructive" className="w-full sm:w-auto">Punch Out</Button>
                  </>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleCardClick("Feedback Submitted Today", getCustomersFromFeedback(feedbackToday))}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feedback Submitted</CardTitle>
                <MessageSquare className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold font-tabular">{feedbackToday.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Total feedback submitted today</p>
            </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleCardClick("Your Customers with PTP Status", uniquePtpCustomers)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your PTP Amount</CardTitle>
                <UserCheck className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold font-tabular flex items-center text-amber-600 dark:text-amber-400">
                    <Rupee className="h-5 w-5 mr-0.5" />
                    {totalPTP.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total in Promise to Pay</p>
            </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleCardClick("Your Customers with Paid Status", uniquePaidCustomers)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Collections</CardTitle>
                 <Rupee className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
                 <div className="text-2xl font-bold font-tabular flex items-center text-emerald-600 dark:text-emerald-400">
                    <Rupee className="h-5 w-5 mr-0.5" />
                    {totalPaid.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total DAC collected from paid accounts</p>
            </CardContent>
        </Card>
         <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleCardClick("Your Not Yet Contacted Customers", notContactedCustomers)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Not Yet Contacted</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold font-tabular">{notContactedCustomers.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Assigned cases not yet contacted</p>
            </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Feedback Status Distribution</CardTitle>
                <CardDescription>Overall feedback disposition breakdown.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
                 <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[250px] w-full max-w-[300px]">
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Pie
                        data={feedbackStatusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        strokeWidth={5}
                      />
                    </PieChart>
                 </ChartContainer>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Your Recent Activity</CardTitle>
                <CardDescription>Recent feedback submissions.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-72">
                    <Table>
                        <TableBody>
                            {recentActivities.map(activity => (
                                <TableRow key={activity.id}>
                                    <TableCell className="p-0">
                                       <Link to={`/customer/${activity.agreementid}`} className="flex items-center justify-between gap-4 p-3.5 hover:bg-muted/35 transition-colors">
                                            <div className='flex-1 min-w-0'>
                                                <p className='font-medium text-sm truncate'>
                                                    {`Feedback for ${getCustomerName(activity.agreementid)}`}
                                                </p>
                                                <p className='text-xs text-muted-foreground'>
                                                    {formatDistanceToNow(parseISO(activity.createdAt), { addSuffix: true })}
                                                </p>
                                            </div>
                                            <span className="text-xs font-semibold text-primary shrink-0">{activity.status}</span>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                             {recentActivities.length === 0 && (
                                <TableRow>
                                    <TableCell className="text-center text-muted-foreground py-8 text-sm">
                                        You have no recent activity.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
      </div>

      <AgentLiveDetailsSheet open={sheetOpen} onOpenChange={setSheetOpen} title={sheetTitle} customers={sheetCustomers} feedbacks={feedbacks} />
    </div>
  );
}
