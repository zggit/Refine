"use client";

import {
  DateField,
  DeleteButton,
  EditButton,
  List,
  ShowButton,
  useTable,
} from "@refinedev/antd";
import type { BaseRecord } from "@refinedev/core";
import { Space, Table, Tag } from "antd";

type EbayOrder = {
  id: number;
  order_id: string;
  buyer_username: string;
  item_title: string;
  status: string;
  total_price: number;
  created_at: string;
};

export default function EbayOrderList() {
  const { tableProps } = useTable<EbayOrder>({
    syncWithLocation: true,
  });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="order_id" title="Order ID" />
        <Table.Column dataIndex="buyer_username" title="Buyer" />
        <Table.Column dataIndex="item_title" title="Item" />
        <Table.Column
          dataIndex="total_price"
          title="Total"
          render={(value: number) =>
            value != null ? `$${value.toFixed(2)}` : "-"
          }
        />
        <Table.Column
          dataIndex="status"
          title="Status"
          render={(value: string) => <Tag>{value}</Tag>}
        />
        <Table.Column
          dataIndex="created_at"
          title="Created At"
          render={(value: string) => <DateField value={value} />}
        />
        <Table.Column
          title="Actions"
          dataIndex="actions"
          render={(_, record: BaseRecord) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <ShowButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
}
