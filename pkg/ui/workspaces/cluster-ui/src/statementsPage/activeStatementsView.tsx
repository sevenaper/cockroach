// Copyright 2022 The Cockroach Authors.
//
// Use of this software is governed by the Business Source License
// included in the file licenses/BSL.txt.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0, included in the file
// licenses/APL.txt.

import React, { useEffect, useState } from "react";
import classNames from "classnames/bind";
import { useHistory } from "react-router-dom";
import {
  ISortedTablePagination,
  SortSetting,
} from "src/sortedtable/sortedtable";
import { Loading } from "src/loading/loading";
import { PageConfig, PageConfigItem } from "src/pageConfig/pageConfig";
import { Search } from "src/search/search";
import {
  ActiveStatement,
  ActiveStatementFilters,
  ExecutionStatus,
} from "src/activeExecutions";
import { Filter } from "src/queryFilter";
import LoadingError from "src/sqlActivity/errorComponent";
import {
  ACTIVE_STATEMENT_SEARCH_PARAM,
  getAppsFromActiveExecutions,
  filterActiveStatements,
} from "../activeExecutions/activeStatementUtils";
import {
  calculateActiveFilters,
  defaultFilters,
  getFullFiltersAsStringRecord,
} from "../queryFilter";
import { ActiveStatementsSection } from "../activeExecutions/activeStatementsSection";
import { queryByName, syncHistory } from "src/util/query";
import { getTableSortFromURL } from "../sortedtable/getTableSortFromURL";
import { getActiveStatementFiltersFromURL } from "src/queryFilter/utils";
import { Pagination } from "src/pagination";
import { InlineAlert } from "@cockroachlabs/ui-components";

import styles from "./statementsPage.module.scss";

const cx = classNames.bind(styles);
const PAGE_SIZE = 20;

export type ActiveStatementsViewDispatchProps = {
  onColumnsSelect: (columns: string[]) => void;
  onFiltersChange: (filters: ActiveStatementFilters) => void;
  onSortChange: (ss: SortSetting) => void;
  refreshLiveWorkload: () => void;
};

export type ActiveStatementsViewStateProps = {
  selectedColumns: string[];
  statements: ActiveStatement[];
  sortSetting: SortSetting;
  sessionsError: Error | null;
  filters: ActiveStatementFilters;
  internalAppNamePrefix: string;
  isTenant?: boolean;
  maxSizeApiReached?: boolean;
};

export type ActiveStatementsViewProps = ActiveStatementsViewStateProps &
  ActiveStatementsViewDispatchProps;

export const ActiveStatementsView: React.FC<ActiveStatementsViewProps> = ({
  onColumnsSelect,
  refreshLiveWorkload,
  onFiltersChange,
  onSortChange,
  selectedColumns,
  sortSetting,
  statements,
  sessionsError,
  filters,
  internalAppNamePrefix,
  isTenant,
  maxSizeApiReached,
}: ActiveStatementsViewProps) => {
  const [pagination, setPagination] = useState<ISortedTablePagination>({
    current: 1,
    pageSize: PAGE_SIZE,
  });
  const history = useHistory();
  const [search, setSearch] = useState<string>(
    queryByName(history.location, ACTIVE_STATEMENT_SEARCH_PARAM),
  );

  useEffect(() => {
    // Refresh every 10 seconds.
    refreshLiveWorkload();
    const interval = setInterval(refreshLiveWorkload, 10 * 1000);
    return () => {
      clearInterval(interval);
    };
  }, [refreshLiveWorkload]);

  useEffect(() => {
    // We use this effect to sync settings defined on the URL (sort, filters),
    // with the redux store. The only time we do this is when the user navigates
    // to the page directly via the URL and specifies settings in the query string.
    // Note that the desired behaviour is currently that the user is unable to
    // clear filters via the URL, and must do so with page controls.
    const sortSettingURL = getTableSortFromURL(history.location);
    const filtersFromURL = getActiveStatementFiltersFromURL(history.location);

    if (sortSettingURL) {
      onSortChange(sortSettingURL);
    }

    if (filtersFromURL) {
      onFiltersChange(filtersFromURL);
    }
  }, [history, onSortChange, onFiltersChange]);

  useEffect(() => {
    // This effect runs when the filters or sort settings received from
    // redux changes and syncs the URL params with redux.
    syncHistory(
      {
        ascending: sortSetting.ascending.toString(),
        columnTitle: sortSetting.columnTitle,
        [ACTIVE_STATEMENT_SEARCH_PARAM]: search,
        ...getFullFiltersAsStringRecord(filters),
      },
      history,
      true,
    );
  }, [
    history,
    filters,
    sortSetting.ascending,
    sortSetting.columnTitle,
    search,
  ]);

  const resetPagination = () => {
    setPagination({
      pageSize: PAGE_SIZE,
      current: 1,
    });
  };

  const onSortClick = (ss: SortSetting): void => {
    onSortChange(ss);
    resetPagination();
  };

  const onSubmitSearch = (newSearch: string): void => {
    if (newSearch === search) return;
    setSearch(newSearch);
    resetPagination();
  };

  const onSubmitFilters = (selectedFilters: ActiveStatementFilters) => {
    onFiltersChange(selectedFilters);
    resetPagination();
  };

  const clearSearch = () => onSubmitSearch("");
  const clearFilters = () =>
    onSubmitFilters({
      app: defaultFilters.app,
      executionStatus: defaultFilters.executionStatus,
    });

  const apps = getAppsFromActiveExecutions(statements, internalAppNamePrefix);
  const countActiveFilters = calculateActiveFilters(filters);
  // The "Idle" execution status does not apply to statements.
  const executionStatuses = Object.values(ExecutionStatus).filter(
    status => status != ExecutionStatus.Idle,
  );
  const filteredStatements = filterActiveStatements(
    statements,
    filters,
    internalAppNamePrefix,
    search,
  );

  const onChangePage = (page: number) => {
    setPagination({
      ...pagination,
      current: page,
    });
  };

  return (
    <div className={cx("root")}>
      <PageConfig>
        <PageConfigItem>
          <Search
            onSubmit={onSubmitSearch}
            onClear={clearSearch}
            defaultValue={search}
          />
        </PageConfigItem>
        <PageConfigItem>
          <Filter
            activeFilters={countActiveFilters}
            onSubmitFilters={onSubmitFilters}
            executionStatuses={executionStatuses}
            showExecutionStatus={true}
            appNames={apps}
            filters={filters}
          />
        </PageConfigItem>
      </PageConfig>
      <div className={cx("table-area")}>
        <Loading
          loading={statements == null}
          page="active statements"
          error={sessionsError}
          renderError={() =>
            LoadingError({
              statsType: "statements",
              error: sessionsError,
            })
          }
        >
          <ActiveStatementsSection
            filters={filters}
            pagination={pagination}
            search={search}
            statements={filteredStatements}
            selectedColumns={selectedColumns}
            sortSetting={sortSetting}
            onClearFilters={clearFilters}
            onChangeSortSetting={onSortClick}
            onColumnsSelect={onColumnsSelect}
            isTenant={isTenant}
          />
          <Pagination
            pageSize={pagination.pageSize}
            current={pagination.current}
            total={filteredStatements?.length}
            onChange={onChangePage}
          />
          {maxSizeApiReached && (
            <InlineAlert
              intent="info"
              title={
                <>
                  Not all contention events are displayed because the maximum
                  number of contention events was reached in the console.
                </>
              }
            />
          )}
        </Loading>
      </div>
    </div>
  );
};
