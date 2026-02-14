import * as XLSX from "xlsx"
import React, { useState, useMemo, useEffect } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from './DataTable'
import type { Column, Filter } from './DataTable'
import { EditDeleteDialog } from './EditDeleteDialog'
import { AddEntryDialog } from './AddEntryDialog'
import { Bar, BarChart, Cell } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

import { categories, subCategoriesMap, departments } from '@/models/data'

const randomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const randomDate = (year = 2024) => new Date(year, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
const randomAmount = (max: number) => parseFloat((Math.random() * max).toFixed(2))

const categoryColors = ["blue", "green", "orange"]

type Scale = "absolute" | "thousands" | "lakhs" | "crores";

const chartConfig = {
  amount: { label: "Expenditure" },
} satisfies ChartConfig

type Receipt = { date: Date; sanctionOrder: string; category: string; amount: number; attachment?: string }
type Allocation = {
  date: Date
  allocationNumber: string
  category: string
  subCategory: string
  department: string
  allocatedAmount: number
}

type Expenditure = { date: Date; billNo: string; voucherNo: string; category: string; subCategory: string; department: string; amount: number; attachment?: string }

const generateReceipts = (count: number): Receipt[] =>
  Array.from({ length: count }, () => ({
    date: randomDate(),
    sanctionOrder: Math.random() > 0.5 ? `${1000 + Math.floor(Math.random() * 9000)}` : `SO-${1000 + Math.floor(Math.random() * 9000)}`,
    category: randomItem(categories),
    amount: randomAmount(100000),
    attachment: Math.random() > 0.5 ? "https://example.com/file.pdf" : undefined
  }))

const generateAllocations = (count: number): Allocation[] =>
  Array.from({ length: count }, () => {
    const category = randomItem(categories)
    const subCategories = subCategoriesMap[category]

    return {
      date: randomDate(),
      allocationNumber: `AL-${1000 + Math.floor(Math.random() * 9000)}`,
      category,
      subCategory: randomItem(subCategories),
      department:
        category === "OH-35 Grants for Creation of Capital Assets"
          ? randomItem(departments.slice(1))
          : "-",
      allocatedAmount: randomAmount(300000),
    }
  })


const generateExpenditures = (count: number): Expenditure[] =>
  Array.from({ length: count }, () => {
    const category = randomItem(categories)
    const subCategories = subCategoriesMap[category]
    return {
      date: randomDate(),
      billNo: Math.random() > 0.5 ? `${1000 + Math.floor(Math.random() * 9000)}` : `BN-${1000 + Math.floor(Math.random() * 9000)}`,
      voucherNo: Math.random() > 0.5 ? `${1000 + Math.floor(Math.random() * 9000)}` : `VN-${1000 + Math.floor(Math.random() * 9000)}`,
      category,
      subCategory: randomItem(subCategories),
      department: category === "OH-35 Grants for Creation of Capital Assets"
        ? randomItem(departments.slice(1))
        : "-",
      amount: randomAmount(50000),
      attachment: Math.random() > 0.5 ? "https://example.com/file.pdf" : undefined
    }
  })

  const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data")

  XLSX.writeFile(workbook, `${fileName}.xlsx`)
}

type SubCategorySummary = {
  subCategory: string
  parentCategory: string
  totalReceipts: number
  totalExpenditure: number
  balance: number
}

const allSubCategories = Object.values(subCategoriesMap).flat()

type Tab = "receipts" | "allocation" | "expenditures" | "reports" | "summary"

const tabs: { value: Tab; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "allocation", label: "Allocation" },
  { value: "receipts", label: "Receipts" },
  { value: "expenditures", label: "Expenditures" },
  { value: "reports", label: "Reports" },
]

export function Dashboard() {
  const [scale, setScale] = useState<Scale>("absolute")
  const [activeTab, setActiveTab] = useState<Tab>("summary")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [allocations, setAllocations] = useState<Allocation[]>(generateAllocations(20))
  const [receipts, setReceipts] = useState<Receipt[]>(generateReceipts(100))
  const [expenditures, setExpenditures] = useState<Expenditure[]>(generateExpenditures(150))
  const [reportType, setReportType] = useState<"expenditure" | "receipts" | null>(null)
  const [filterType, setFilterType] = useState<"dateRange" | "financialYear" | null>(null)
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<string>("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("")
    const formatDateForExport = (date: Date) =>
    date.toLocaleDateString("en-IN")

    type AllocationFilters = {
      allocationNumber?: string
      department?: string
      category?: string
      subCategory?: string
      ohCategory?: string
      fy?: string
      dateFrom?: string
      dateTo?: string
      minAmount?: string
      maxAmount?: string
    }


    const [allocationFilterValues, setAllocationFilterValues] = useState<AllocationFilters>({})
    useEffect(() => {
      setAllocationPage(1)
    }, [allocationFilterValues])

    const getFY = (date: Date) => {
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`
    }
    // 🔹 Master OH category list
  const allOHCategories = categories
  const [allocationPage, setAllocationPage] = useState(1)
  const allocationsPerPage = 1

  // 🔹 Group allocations by allocation number
    const filteredAllocations = useMemo(() => {
      return allocations.filter(a => {
        const amount = Number(a.allocatedAmount)
        const date = new Date(a.date)

        if (allocationFilterValues.allocationNumber &&
            !a.allocationNumber.toLowerCase().includes(allocationFilterValues.allocationNumber.toLowerCase()))
          return false

        if (allocationFilterValues.department && a.department !== allocationFilterValues.department) return false
        if (allocationFilterValues.category && a.category !== allocationFilterValues.category) return false
        if (allocationFilterValues.subCategory && a.subCategory !== allocationFilterValues.subCategory) return false
        if (allocationFilterValues.ohCategory && a.category !== allocationFilterValues.ohCategory) return false
        if (allocationFilterValues.fy && getFY(date) !== allocationFilterValues.fy) return false

        if (allocationFilterValues.dateFrom && date < new Date(allocationFilterValues.dateFrom)) return false
        if (allocationFilterValues.dateTo && date > new Date(allocationFilterValues.dateTo)) return false

        if (allocationFilterValues.minAmount && amount < Number(allocationFilterValues.minAmount)) return false
        if (allocationFilterValues.maxAmount && amount > Number(allocationFilterValues.maxAmount)) return false

        return true
      })
    }, [allocations, allocationFilterValues])



const allocationsByNumber = useMemo(() => {
  const map: Record<string, Allocation[]> = {}

  filteredAllocations.forEach(a => {
    if (!map[a.allocationNumber]) map[a.allocationNumber] = []
    map[a.allocationNumber].push(a)
  })

  return map
}, [filteredAllocations])

const allocationTables = useMemo(() => {
  return Object.entries(allocationsByNumber).map(([allocNo, entries]) => {
    const date = entries[0].date

    const rows = allOHCategories.map(category => {
      const match = entries.find(e => e.category === category)

      return match || {
        allocationNumber: allocNo,
        date,
        category,
        subCategory: "-",
        department: "-",
        allocatedAmount: 0,
      }
    })

    return {
      allocationNumber: allocNo,
      date,
      rows,
      total: rows.reduce((s, r) => s + r.allocatedAmount, 0),
    }
  })
}, [allocationsByNumber, allOHCategories])

    const groupedAllocations = useMemo(() => {
      const map: Record<string, Allocation[]> = {}

      allocations.forEach(a => {
        if (!map[a.allocationNumber]) map[a.allocationNumber] = []
        map[a.allocationNumber].push(a)
      })

      return map
    }, [allocations])
    const totalAllocationPages = Math.ceil(allocationTables.length / allocationsPerPage)

    const paginatedAllocationTables = useMemo(() => {
      const start = (allocationPage - 1) * allocationsPerPage
      return allocationTables.slice(start, start + allocationsPerPage)
    }, [allocationTables, allocationPage])

    const allocationDisplayRows = useMemo(() => {
      const rows: any[] = []

      Object.entries(groupedAllocations).forEach(([allocNo, entries]) => {
        const first = entries[0]

        // Header row
        rows.push({
          isHeader: true,
          allocationNumber: allocNo,
          date: first.date,
          category: "",
          subCategory: "",
          department: "",
          allocatedAmount: entries.reduce((sum, e) => sum + e.allocatedAmount, 0),
        })

        // Detail rows
        entries.forEach(e => {
          rows.push({
            ...e,
            isHeader: false,
          })
        })
      })

      return rows
    }, [groupedAllocations])


  const allocationExportData = filteredAllocations.map(a => ({
    Date: formatDateForExport(a.date),
    AllocationNumber: a.allocationNumber,
    Category: a.category,
    SubCategory: a.subCategory,
    Department: a.department,
    AllocatedAmount: a.allocatedAmount,
  }))

  const formatINR = (value: number) => {
    let displayValue = value;
    let suffix = "";

    if (scale === "thousands") {
      displayValue = value / 1000;
      suffix = " K";
    } else if (scale === "lakhs") {
      displayValue = value / 100000;
      suffix = " L";
    } else if (scale === "crores") {
      displayValue = value / 10000000;
      suffix = " Cr";
    }

    const absVal = Math.abs(displayValue);
    return `${value < 0 ? "- " : ""}₹${absVal.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}${suffix}`;
  };

  const toggleRow = (category: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const canModify = true

  const handleReceiptAdd = (newReceipt: Receipt) => {
    setReceipts(prev => [newReceipt, ...prev])
  }

  const handleReceiptSave = (index: number) => (updatedReceipt: Receipt) => {
    setReceipts(prev => {
      const newReceipts = [...prev]
      newReceipts[index] = updatedReceipt
      return newReceipts
    })
  }

  const handleReceiptDelete = (index: number) => () => {
    setReceipts(prev => prev.filter((_, i) => i !== index))
  }
const handleAllocationAdd = (newAllocation: Allocation) => {
  setAllocations(prev => [newAllocation, ...prev])
}

  const handleExpenditureAdd = (newExpenditure: Expenditure) => {
    setExpenditures(prev => [newExpenditure, ...prev])
  }

  const handleExpenditureSave = (index: number) => (updatedExpenditure: Expenditure) => {
    setExpenditures(prev => {
      const newExpenditures = [...prev]
      newExpenditures[index] = updatedExpenditure
      return newExpenditures
    })
  }

  const handleExpenditureDelete = (index: number) => () => {
    setExpenditures(prev => prev.filter((_, i) => i !== index))
  }

  const receiptFields = [
    { key: "date", label: "Date", type: "date" as const, required: true },
    { key: "sanctionOrder", label: "Sanction Order", type: "text" as const, required: true },
    { key: "category", label: "OH Category", type: "select" as const, options: categories, required: true },
    { key: "amount", label: "Amount", type: "number" as const, required: true },
    { key: "attachment", label: "Attachment URL", type: "text" as const, required: false },
  ]
const allocationFields = [
  { key: "date", label: "Date", type: "date" as const, required: true },
  { key: "allocationNumber", label: "Allocation Number", type: "text" as const, required: true },
  { key: "category", label: "OH Category", type: "select" as const, options: categories, required: true },
  { 
    key: "subCategory", 
    label: "OH Sub-category", 
    type: "select" as const, 
    required: true,
    dependsOn: "category",
    getDynamicOptions: (formData: any) =>
      formData.category ? subCategoriesMap[formData.category] : []
  },
  { key: "department", label: "Department", type: "select" as const, options: ["-", ...departments.slice(1)], required: true },
  { key: "allocatedAmount", label: "Allocated Amount", type: "number" as const, required: true },
]

  const expenditureFields = [
    { key: "date", label: "Date", type: "date" as const, required: true },
    { key: "billNo", label: "Bill No.", type: "text" as const, required: true },
    { key: "voucherNo", label: "Voucher No.", type: "text" as const, required: true },
    { key: "category", label: "OH Category", type: "select" as const, options: categories, required: true },
    { 
      key: "subCategory", 
      label: "OH Sub-category", 
      type: "select" as const, 
      required: true,
      dependsOn: "category",
      getDynamicOptions: (formData: any) => formData.category ? subCategoriesMap[formData.category] : []
    },
    { key: "department", label: "Department", type: "select" as const, options: ["-", ...departments.slice(1)], required: true },
    { key: "amount", label: "Amount", type: "number" as const, required: true },
    { key: "attachment", label: "Attachment URL", type: "text" as const, required: false },
  ]

  const receiptColumns: Column<Receipt & { _index: number }>[] = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      format: d => d instanceof Date
        ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : String(d)
    },
    { key: "sanctionOrder", label: "Sanction Order", sortable: true },
    { key: "category", label: "OH Category", sortable: true },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      className: "text-right",
      format: a => typeof a === "number" ? formatINR(a) : "-"
    },
    {
      key: "attachment",
      label: "Attachment",
      format: url => url
        ? <a href={String(url)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
        : "-"
    },
    {
      key: "_index",
      label: "Actions",
      format: (_, row) => (
        canModify ? 
        <EditDeleteDialog
          row={row}
          fields={receiptFields}
          onSave={handleReceiptSave(row._index)}
          onDelete={handleReceiptDelete(row._index)}
          formatDisplay={(key, value) => {
            if (key === "date" && value instanceof Date) {
              return value.toISOString().split('T')[0]
            }
            return String(value ?? "")
          }}
        /> : <>-</>
      )
    }
  ]

const allocationColumns: Column<any>[] = [
  {
    key: "date",
    label: "Date",
    sortable: true,
    format: (d, row) =>
      row.isHeader
        ? d instanceof Date
          ? d.toLocaleDateString("en-IN")
          : ""
        : d instanceof Date
        ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : String(d)
  },
  {
    key: "allocationNumber",
    label: "Allocation No.",
    sortable: true,
    format: (val, row) =>
      row.isHeader ? (
        <span className="font-bold text-blue-600">
          {val} (Total)
        </span>
      ) : (
        val
      ),
  },
  {
    key: "category",
    label: "OH Category",
    sortable: true,
    format: (val, row) => (row.isHeader ? "" : val),
  },
  {
    key: "subCategory",
    label: "OH Sub-category",
    sortable: true,
    format: (val, row) => (row.isHeader ? "" : val),
  },
  {
    key: "department",
    label: "Department",
    sortable: true,
    format: (val, row) => (row.isHeader ? "" : val),
  },
  {
    key: "allocatedAmount",
    label: "Allocated Amount",
    sortable: true,
    className: "text-right",
    format: (val) =>
      typeof val === "number" ? formatINR(val) : "-",
  },
]

  const expenditureColumns: Column<Expenditure & { _index: number }>[] = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      format: d => d instanceof Date
        ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : String(d)
    },
    { key: "billNo", label: "Bill No.", sortable: true },
    { key: "voucherNo", label: "Voucher No.", sortable: true },
    { key: "category", label: "OH Category", sortable: true },
    { key: "subCategory", label: "OH Sub-category", sortable: true },
    { key: "department", label: "Department", sortable: true },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      className: "text-right",
      format: a => typeof a === "number" ? formatINR(a) : "-"
    },
    {
      key: "attachment",
      label: "Attachment",
      format: url => url
        ? <a href={String(url)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
        : "-"
    },
    {
      key: "_index",
      label: "Actions",
      format: (_, row) => (
        canModify ?
        <EditDeleteDialog
          row={row}
          fields={expenditureFields}
          onSave={handleExpenditureSave(row._index)}
          onDelete={handleExpenditureDelete(row._index)}
          formatDisplay={(key, value) => {
            if (key === "date" && value instanceof Date) {
              return value.toISOString().split('T')[0]
            }
            return String(value ?? "")
          }}
        /> : <>-</>
      )
    }
  ]

  const receiptFilters: Filter<Receipt>[] = [
    { key: "sanctionOrder", type: "text", label: "Sanction Order", placeholder: "Search Sanction Order" },
    { key: "category", type: "select", label: "Category", options: categories },
    { key: "amountMin", type: "number", label: "Min Amount", placeholder: "Min ₹", filterFn: (row, val) => row.amount >= Number(val) },
    { key: "amountMax", type: "number", label: "Max Amount", placeholder: "Max ₹", filterFn: (row, val) => row.amount <= Number(val) },
    { key: "dateFrom", type: "date", label: "From Date", filterFn: (row, val) => row.date >= new Date(val) },
    { key: "dateTo", type: "date", label: "To Date", filterFn: (row, val) => row.date <= new Date(val) }
  ]


  const expenditureFilters: Filter<Expenditure>[] = [
    { key: "billNo", type: "text", label: "Bill No.", placeholder: "Search Bill No." },
    { key: "voucherNo", type: "text", label: "Voucher No.", placeholder: "Search Voucher No." },
    { key: "category", type: "select", label: "Category", options: categories },
    { key: "subCategory", type: "select", label: "Sub-category" },
    { key: "expenditureMin", type: "number", label: "Min Expenditure", placeholder: "Min ₹", filterFn: (row, val) => row.amount >= Number(val) },
    { key: "expenditureMax", type: "number", label: "Max Expenditure", placeholder: "Max ₹", filterFn: (row, val) => row.amount <= Number(val) },
    { key: "dateFrom", type: "date", label: "From Date", filterFn: (row, val) => row.date >= new Date(val) },
    { key: "dateTo", type: "date", label: "To Date", filterFn: (row, val) => row.date <= new Date(val) }
  ]

  const summaryCategoryData = useMemo(() => {
    return categories.map(category => {
      const totalReceipts = receipts.filter(r => r.category === category).reduce((sum, r) => sum + r.amount, 0)
      const totalExpenditures = expenditures.filter(e => e.category === category).reduce((sum, e) => sum + e.amount, 0)
      const subs = subCategoriesMap[category] ?? []
      const subCategories: SubCategorySummary[] = subs.map(sub => {
        const subReceipts = 0
        const subExpenditure = expenditures
          .filter(e => e.category === category && e.subCategory === sub)
          .reduce((sum, e) => sum + e.amount, 0)
        return { 
          subCategory: sub, 
          parentCategory: category,
          totalReceipts: subReceipts, 
          totalExpenditure: subExpenditure, 
          balance: subReceipts - subExpenditure 
        }
      })
      return { category, totalReceipts, totalExpenditure: totalExpenditures, balance: totalReceipts - totalExpenditures, subCategories }
    })
  }, [receipts, expenditures])

  const chartData = useMemo(() => {
    if (expandedRows.size === 0) return summaryCategoryData.flatMap(cat => cat.subCategories)
    return summaryCategoryData.filter(cat => expandedRows.has(cat.category)).flatMap(cat => cat.subCategories)
  }, [summaryCategoryData, expandedRows])

  const financialYears = useMemo(() => {
    const allDates = [
      ...receipts.map(r => r.date),
      ...expenditures.map(e => e.date),
      ...allocations.map(a => a.date)
    ]
    const uniqueFYs = Array.from(new Set(allDates.map(date => getFY(date))))
    return uniqueFYs.sort().reverse()
  }, [receipts, expenditures, allocations])

  const receiptsWithIndex = receipts.map((r, i) => ({ ...r, _index: i }))
  const expendituresWithIndex = expenditures.map((e, i) => ({ ...e, _index: i }))

  // Filter data for reports
  const filteredReportData = useMemo(() => {
    if (!reportType || !filterType) return []

    let data: (Receipt | Expenditure)[] = reportType === "expenditure" ? expenditures : receipts

    // Apply date range or financial year filter
    if (filterType === "dateRange") {
      if (startDate) {
        const start = new Date(startDate)
        data = data.filter(item => item.date >= start)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999) // Include the entire end date
        data = data.filter(item => item.date <= end)
      }
    } else if (filterType === "financialYear" && selectedFinancialYear) {
      data = data.filter(item => getFY(item.date) === selectedFinancialYear)
    }

    // Apply additional filters for expenditure
    if (reportType === "expenditure") {
      const expData = data as Expenditure[]
      if (selectedCategory) {
        data = expData.filter(item => item.category === selectedCategory)
      }
      if (selectedDepartment) {
        data = expData.filter(item => item.department === selectedDepartment)
      }
    }

    return data
  }, [reportType, filterType, startDate, endDate, selectedFinancialYear, selectedCategory, selectedDepartment, expenditures, receipts])

  // Prepare export data
  const reportExportData = useMemo(() => {
    if (reportType === "expenditure") {
      return (filteredReportData as Expenditure[]).map(e => ({
        Date: formatDateForExport(e.date),
        "Bill No.": e.billNo,
        "Voucher No.": e.voucherNo,
        "OH Category": e.category,
        "OH Sub-category": e.subCategory,
        Department: e.department,
        Amount: e.amount,
        Attachment: e.attachment || ""
      }))
    } else {
      return (filteredReportData as Receipt[]).map(r => ({
        Date: formatDateForExport(r.date),
        "Sanction Order": r.sanctionOrder,
        "OH Category": r.category,
        Amount: r.amount,
        Attachment: r.attachment || ""
      }))
    }
  }, [filteredReportData, reportType])

  return (
    <>
      <div className="flex items-start justify-between pb-4">
        <div className="pt-2">
          <img
            src="https://departments.nitj.ac.in/static/media/logo.f2c76d0937070ba81dc0.png"
            alt="NIT Jalandhar Logo"
            className="h-16 w-16 object-contain"
          />
        </div>
        <div className="flex-1 flex flex-col items-center pb-8">
          <div className="text-3xl font-extrabold text-center mb-2">
            Dr B R Ambedkar National Institute of Technology Jalandhar
          </div>
          <h1 className="text-2xl font-bold text-center">
            Ministry Grants Receipts & Expenditures
          </h1>
        </div>
        {/* spacer to keep center alignment with logo on the left */}
        <div className="h-16 w-16" />
      </div>


      <div className="flex flex-row items-end gap-2 mb-6">
        {tabs.map((tab) => (
          <Button
            key={tab.value}
            variant={activeTab === tab.value ? "default" : "outline"}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
        <div className="flex flex-row w-full justify-end">
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Currency Scale</span>
            <div className="inline-flex px-1 py-1 bg-muted rounded-lg border">
              {(["absolute", "thousands", "lakhs", "crores"] as Scale[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={cn(
                    "px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize",
                    scale === s 
                      ? "bg-background text-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeTab === "receipts" && (
        <>
          <div className="flex justify-end">
            <AddEntryDialog
              fields={receiptFields}
              onAdd={handleReceiptAdd}
              title="Add Receipt"
              buttonLabel="Add Receipt"
            />
          </div>
          <DataTable
            data={receiptsWithIndex}
            columns={receiptColumns}
            filters={receiptFilters}
            defaultSort="date"
          />
        </>
      )}
      {activeTab === "allocation" && (
        <>
          <div className="flex justify-between mb-4">
            <AddEntryDialog
              fields={allocationFields}
              onAdd={handleAllocationAdd}
              title="Add / Revise Fund"
              buttonLabel="Add / Revise Fund"
            />

            <Button
              variant="outline"
              onClick={() => exportToExcel(allocationExportData, "Allocations")}
            >
              Download Excel
            </Button>
          </div>
          {/* 🔎 Allocation Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 mt-4">
            {/* Allocation Number */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Allocation No.</label>
              <Input
                placeholder="Search Allocation No."
                value={allocationFilterValues.allocationNumber || ""}
                onChange={e =>
                  setAllocationFilterValues(p => ({ ...p, allocationNumber: e.target.value }))
                }
              />
            </div>

            {/* Financial Year */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Financial Year</label>
              <Select
                value={allocationFilterValues.fy || "all"}
                onValueChange={v =>
                  setAllocationFilterValues(p => ({ ...p, fy: v === "all" ? "" : v }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Select FY" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All FY</SelectItem>
                  {Array.from(new Set(allocations.map(a => getFY(a.date)))).map(fy => (
                    <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Min Amount */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Min Amount</label>
              <Input
                placeholder="Min ₹"
                type="number"
                value={allocationFilterValues.minAmount || ""}
                onChange={e =>
                  setAllocationFilterValues(p => ({ ...p, minAmount: e.target.value }))
                }
              />
            </div>

            {/* Max Amount */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Max Amount</label>
              <Input
                placeholder="Max ₹"
                type="number"
                value={allocationFilterValues.maxAmount || ""}
                onChange={e =>
                  setAllocationFilterValues(p => ({ ...p, maxAmount: e.target.value }))
                }
              />
            </div>

            {/* From Date */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={allocationFilterValues.dateFrom || ""}
                onChange={e =>
                  setAllocationFilterValues(p => ({ ...p, dateFrom: e.target.value }))
                }
              />
            </div>

            {/* To Date */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={allocationFilterValues.dateTo || ""}
                onChange={e =>
                  setAllocationFilterValues(p => ({ ...p, dateTo: e.target.value }))
                }
              />
          </div>

        </div>


          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Select
              value={allocationFilterValues.department || "all"}
              onValueChange={v => setAllocationFilterValues(p => ({ ...p, department: v === "all" ? "" : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select
              value={allocationFilterValues.category || "all"}
              onValueChange={v => setAllocationFilterValues(p => ({ ...p, category: v === "all" ? "" : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select
              value={allocationFilterValues.subCategory || "all"}
              onValueChange={v => setAllocationFilterValues(p => ({ ...p, subCategory: v === "all" ? "" : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Sub-category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sub-categories</SelectItem>
                {allSubCategories.map(sc => <SelectItem key={sc} value={sc}>{sc}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {paginatedAllocationTables.map(table => (
            <div key={table.allocationNumber} className="mb-8 border rounded-lg p-4">
              <div className="flex justify-between mb-3">
                <h3 className="font-semibold text-lg text-blue-600">
                  {table.allocationNumber}
                </h3>
                <span className="font-semibold">
                  Total: {formatINR(table.total)}
                </span>
              </div>

              <DataTable
                data={table.rows.map((r, i) => ({ ...r, _index: i }))}
                columns={allocationColumns}
                performPagination={false}
                showResultCount={false}
              />

            </div>
          ))}
          <div className="flex items-center justify-between mt-6 text-sm">
            {/* Left: Page info */}
            <div className="text-muted-foreground">
              Page {allocationPage} of {totalAllocationPages}
            </div>

            {/* Right: controls + result count */}
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                {allocationTables.length} result(s) found
              </span>

              <div className="flex border rounded-md overflow-hidden">
                <button
                  disabled={allocationPage === 1}
                  onClick={() => setAllocationPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 border-r disabled:opacity-40 hover:bg-muted"
                >
                  ‹
                </button>
                <button
                  disabled={allocationPage === totalAllocationPages}
                  onClick={() => setAllocationPage(p => Math.min(totalAllocationPages, p + 1))}
                  className="px-3 py-1 disabled:opacity-40 hover:bg-muted"
                >
                  ›
                </button>
              </div>
            </div>
          </div>



        </>
      )}


      {activeTab === "expenditures" && (
        <>
          <div className="flex justify-end">
            <AddEntryDialog
              fields={expenditureFields}
              onAdd={handleExpenditureAdd}
              title="Add Expenditure"
              buttonLabel="Add Expenditure"
            />
          </div>
          <DataTable
            data={expendituresWithIndex}
            columns={expenditureColumns}
            filters={expenditureFilters}
            defaultSort="date"
            dynamicSelectOptions={{ subCategory: (fv) => fv.category ? subCategoriesMap[fv.category] : allSubCategories }}
          />
        </>
      )}

      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-6">View Report</h2>
            
            {/* Report Type Selection */}
            <div className="space-y-4 mb-6">
              <Label className="text-base font-medium">Select Report Type</Label>
              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="report-expenditure"
                    name="reportType"
                    value="expenditure"
                    checked={reportType === "expenditure"}
                    onChange={(e) => {
                      setReportType(e.target.value as "expenditure")
                      setFilterType(null)
                      setStartDate("")
                      setEndDate("")
                      setSelectedFinancialYear("")
                      setSelectedCategory("")
                      setSelectedDepartment("")
                    }}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="report-expenditure" className="cursor-pointer">
                    Expenditure
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="report-receipts"
                    name="reportType"
                    value="receipts"
                    checked={reportType === "receipts"}
                    onChange={(e) => {
                      setReportType(e.target.value as "receipts")
                      setFilterType(null)
                      setStartDate("")
                      setEndDate("")
                      setSelectedFinancialYear("")
                      setSelectedCategory("")
                      setSelectedDepartment("")
                    }}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="report-receipts" className="cursor-pointer">
                    Receipts
                  </Label>
                </div>
              </div>
            </div>

            {/* Filter Options - Only show when report type is selected */}
            {reportType && (
              <div className="space-y-4 border-t pt-6">
                <Label className="text-base font-medium">Select Filter Type</Label>
                <div className="flex gap-6 mb-6">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="filter-dateRange"
                      name="filterType"
                      value="dateRange"
                      checked={filterType === "dateRange"}
                      onChange={() => {
                        setFilterType("dateRange")
                        setSelectedFinancialYear("")
                      }}
                      className="h-4 w-4 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="filter-dateRange" className="cursor-pointer">
                      Date Range
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="filter-financialYear"
                      name="filterType"
                      value="financialYear"
                      checked={filterType === "financialYear"}
                      onChange={() => {
                        setFilterType("financialYear")
                        setStartDate("")
                        setEndDate("")
                      }}
                      className="h-4 w-4 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="filter-financialYear" className="cursor-pointer">
                      Financial Year
                    </Label>
                  </div>
                </div>

                {/* Date Range Inputs */}
                {filterType === "dateRange" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Financial Year Select */}
                {filterType === "financialYear" && (
                  <div className="space-y-2">
                    <Label htmlFor="financialYear">Financial Year</Label>
                    <Select
                      value={selectedFinancialYear}
                      onValueChange={setSelectedFinancialYear}
                    >
                      <SelectTrigger id="financialYear" className="w-full max-w-xs">
                        <SelectValue placeholder="Select Financial Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {financialYears.map((fy) => (
                          <SelectItem key={fy} value={fy}>
                            {fy}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Additional Filters for Expenditure */}
                {reportType === "expenditure" && (
                  <div className="space-y-4 border-t pt-6 mt-6">
                    <Label className="text-base font-medium">Additional Filters</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="reportCategory">OH Category</Label>
                        <Select
                          value={selectedCategory || "all"}
                          onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}
                        >
                          <SelectTrigger id="reportCategory" className="w-full">
                            <SelectValue placeholder="Select OH Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reportDepartment">Department</Label>
                        <Select
                          value={selectedDepartment || "all"}
                          onValueChange={(value) => setSelectedDepartment(value === "all" ? "" : value)}
                        >
                          <SelectTrigger id="reportDepartment" className="w-full">
                            <SelectValue placeholder="Select Department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {["-", ...departments.slice(1)].map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Display filtered results */}
            {reportType && filterType && filteredReportData.length > 0 && (
              <div className="mt-8 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">
                    {reportType === "expenditure" ? "Expenditure" : "Receipts"} Report
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({filteredReportData.length} {filteredReportData.length === 1 ? "record" : "records"})
                    </span>
                  </h3>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const fileName = `${reportType === "expenditure" ? "Expenditure" : "Receipts"}_Report_${new Date().toISOString().split('T')[0]}`
                      exportToExcel(reportExportData, fileName)
                    }}
                  >
                    Download Excel
                  </Button>
                </div>
                {reportType === "expenditure" && (
                  <DataTable<(Expenditure & { _index: number })>
                    data={(filteredReportData as Expenditure[]).map((e) => {
                      const originalIndex = expenditures.findIndex(exp => 
                        exp.date.getTime() === e.date.getTime() &&
                        exp.billNo === e.billNo &&
                        exp.voucherNo === e.voucherNo &&
                        exp.amount === e.amount
                      )
                      return { ...e, _index: originalIndex >= 0 ? originalIndex : 0 }
                    })}
                    columns={expenditureColumns}
                    filters={[]}
                    defaultSort="date"
                  />
                )}
                {reportType === "receipts" && (
                  <DataTable<(Receipt & { _index: number })>
                    data={(filteredReportData as Receipt[]).map((r) => {
                      const originalIndex = receipts.findIndex(rec => 
                        rec.date.getTime() === r.date.getTime() &&
                        rec.sanctionOrder === r.sanctionOrder &&
                        rec.amount === r.amount
                      )
                      return { ...r, _index: originalIndex >= 0 ? originalIndex : 0 }
                    })}
                    columns={receiptColumns}
                    filters={[]}
                    defaultSort="date"
                  />
                )}
              </div>
            )}

            {/* Show message when filters are applied but no data matches */}
            {reportType && filterType && filteredReportData.length === 0 && (
              <div className="mt-8 rounded-lg border p-8 text-center text-muted-foreground">
                No records found matching the selected filters.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "summary" && (
        <div className="space-y-2">
          <div className="flex flex-col items-center px-8 py-4 rounded-lg border">
            <h3 className="text-md font-semibold mb-2 text-muted-foreground self-start">Expenditure Breakdown</h3>
            <ChartContainer config={chartConfig} className="h-80 w-full max-w-4xl">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <ChartTooltip 
                  content={
                    <ChartTooltipContent 
                      formatter={(value, _, item) => (
                        <div className="flex flex-col">
                          <span className="text-xs font-bold">
                            {item.payload.parentCategory}
                          </span>
                          <span className="text-xs font-semibold">{item.payload.subCategory}</span>
                          <span className="text-lg font-semibold text-primary">{formatINR(Number(value))}</span>
                        </div>
                      )}
                    />
                  } 
                />
                <Bar dataKey="totalExpenditure" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={categoryColors[categories.indexOf(entry.parentCategory) % categoryColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>

          <div className="overflow-hidden border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="px-4 py-3 text-left font-medium w-8" />
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Total Receipts</th>
                  <th className="px-4 py-3 text-right font-medium">Total Expenditures</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {summaryCategoryData.map((row, idx) => {
                  const isExpanded = expandedRows.has(row.category)
                  const color = categoryColors[idx % categoryColors.length]
                  const hasSubCategories = row.subCategories.length > 0
                  const pct = row.totalReceipts > 0 ? Math.min((row.totalExpenditure / row.totalReceipts) * 100, 100) : 0
                  
                  return (
                    <React.Fragment key={row.category}>
                      <tr
                        onClick={() => hasSubCategories && toggleRow(row.category)}
                        className={`border-b transition-colors ${hasSubCategories ? "cursor-pointer hover:bg-muted/50" : ""}`}
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {hasSubCategories ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <div className="mb-1.5">{row.category}</div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{formatINR(row.totalReceipts)}</td>
                        <td className="px-4 py-3 text-right">{formatINR(row.totalExpenditure)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${row.balance < 0 ? "text-red-700" : "text-green-700"}`}>
                          {formatINR(row.balance)}
                        </td>
                      </tr>

                      {isExpanded && row.subCategories.map((sub) => (
                        <tr key={`${row.category}-${sub.subCategory}`} className="border-b bg-muted">
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2 pl-8 text-muted-foreground">{sub.subCategory}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">—</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{formatINR(sub.totalExpenditure)}</td>
                          <td className={`px-4 py-2 text-right text-muted-foreground`}>
                            {sub.totalExpenditure > 0 ? formatINR(-sub.totalExpenditure) : "—"}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
