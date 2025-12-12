/**
 * Provider Comparison Table Component
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  TrendingUp, 
  TrendingDown 
} from "lucide-react";
import { formatUSD, formatPercentage, type ProviderMetrics } from "../utils/calculations";

interface ProviderComparisonTableProps {
  metrics: ProviderMetrics[];
  onProviderClick: (providerId: string) => void;
}

type SortField = 'name' | 'revenue' | 'share' | 'growth' | 'claims';
type SortDirection = 'asc' | 'desc';

export function ProviderComparisonTable({ metrics, onProviderClick }: ProviderComparisonTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let data = [...metrics];

    // Filter by search term
    if (searchTerm) {
      data = data.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort data
    data.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'name') {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      } else if (sortField === 'claims') {
        aVal = a.claimsCount;
        bVal = b.claimsCount;
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return data;
  }, [metrics, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1" />
      : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  const getStatusBadgeVariant = (status: ProviderMetrics['status']) => {
    switch (status) {
      case 'TOP PERFORMER':
        return 'default';
      case 'RISING STAR':
        return 'secondary';
      case 'NEEDS ATTENTION':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="border-violet-200/50 dark:border-violet-800/50 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            Provider Comparison
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search providers..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('name')}
                    className="hover:bg-violet-50 dark:hover:bg-violet-900/20"
                  >
                    Provider
                    <SortIcon field="name" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('claims')}
                    className="hover:bg-violet-50 dark:hover:bg-violet-900/20"
                  >
                    Claims
                    <SortIcon field="claims" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('revenue')}
                    className="hover:bg-violet-50 dark:hover:bg-violet-900/20"
                  >
                    Revenue
                    <SortIcon field="revenue" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('share')}
                    className="hover:bg-violet-50 dark:hover:bg-violet-900/20"
                  >
                    Share
                    <SortIcon field="share" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('growth')}
                    className="hover:bg-violet-50 dark:hover:bg-violet-900/20"
                  >
                    Growth
                    <SortIcon field="growth" />
                  </Button>
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((provider, index) => {
                const getMedalBadge = (rank: number) => {
                  if (rank === 1) {
                    return (
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-lg font-bold shadow-lg">
                        🥇
                      </div>
                    );
                  } else if (rank === 2) {
                    return (
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-gray-300 to-gray-500 text-white text-lg font-bold shadow-lg">
                        🥈
                      </div>
                    );
                  } else if (rank === 3) {
                    return (
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-amber-600 to-amber-800 text-white text-lg font-bold shadow-lg">
                        🥉
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold shadow-md">
                        {rank}
                      </div>
                    );
                  }
                };

                return (
                  <TableRow
                    key={provider.id}
                    className="cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                    onClick={() => onProviderClick(provider.id)}
                  >
                    <TableCell className="font-medium">
                      {getMedalBadge(provider.rank)}
                    </TableCell>
                    <TableCell className="font-semibold">{provider.name}</TableCell>
                    <TableCell>{provider.claimsCount.toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">{formatUSD(provider.revenue)}</TableCell>
                    <TableCell>{formatPercentage(provider.share)}</TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 font-semibold ${
                        provider.growth >= 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {provider.growth >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {formatPercentage(Math.abs(provider.growth))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(provider.status)} className="text-xs">
                        {provider.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} providers
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
