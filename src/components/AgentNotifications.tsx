// @ts-nocheck
import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';
import { format, isToday, isFuture, parseISO } from 'date-fns';
import { Bell } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Link } from '@/lib/router-compat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function AgentNotifications() {
  const { user } = useAuth();

  const feedbacks = useLiveQuery(
    () => user ? db.customer_feedbacks.where('agentId').equals(user.id).toArray() : []
  ) || [];

  const records = useLiveQuery(() => db.loan_records.toArray()) || [];

  const notifications = useMemo(() => {
    if (!user || feedbacks.length === 0 || records.length === 0) return [];
    
    const ptpReminders = feedbacks
      .filter(f => f.status === 'PTP' && f.ptpDate && (isToday(parseISO(f.ptpDate)) || isFuture(parseISO(f.ptpDate))))
      .map(f => ({
        type: 'PTP',
        feedback: f,
        customer: records.find(r => r.agreementid === f.agreementid),
        date: f.ptpDate!,
      }));

    const cbReminders = feedbacks
      .filter(f => f.status === 'CB' && f.cbDate && (isToday(parseISO(f.cbDate)) || isFuture(parseISO(f.cbDate))))
      .map(f => ({
        type: 'CB',
        feedback: f,
        customer: records.find(r => r.agreementid === f.agreementid),
        date: f.cbDate!,
      }));
      
    return [...ptpReminders, ...cbReminders]
        .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

  }, [feedbacks, records, user]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
             <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 text-[10px]">
                {notifications.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Reminders</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-72">
            {notifications.length > 0 ? (
                notifications.map(({ type, feedback, customer, date }) => {
                  const customerName = customer ? (customer.customer_name || customer['Customer Name'] || customer.CUSTOMERNAME || 'Unknown Customer') : 'Unknown Customer';
                  
                  return (
                    <DropdownMenuItem key={feedback.id} asChild>
                        <Link to={`/exec/cases/${feedback.agreementid}`} className="flex flex-col items-start gap-1 p-2 cursor-pointer outline-none">
                            <div className="flex justify-between w-full">
                                <span className="font-semibold text-sm truncate pr-2">{customerName}</span>
                                <Badge variant={type === 'PTP' ? 'default' : 'secondary'} className="text-[10px] uppercase font-bold">
                                  {type}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium">
                                {format(parseISO(date), "PPP 'at' p")}
                            </p>
                        </Link>
                    </DropdownMenuItem>
                  );
                })
            ) : (
                <p className="text-sm text-muted-foreground text-center p-6">No upcoming reminders.</p>
            )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
