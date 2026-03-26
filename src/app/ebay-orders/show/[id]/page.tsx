"use client";

import { DateField, NumberField, Show, TextField } from "@refinedev/antd";
import { useShow } from "@refinedev/core";
import { Tag, Typography } from "antd";

type EbayOrder = {
  id: number;
  order_id: string;
  buyer_username: string;
  item_title: string;
  status: string;
  total_price: number;
  created_at: string;
};

const { Title } = Typography;

export default function EbayOrderShow() {
  const { result: record, query } = useShow<EbayOrder>({});
  const { isLoading } = query;

  return (
    <Show isLoading={isLoading}>
      <Title level={5}>Order ID</Title>
      <TextField value={record?.order_id} />
      <Title level={5}>Buyer</Title>
      <TextField value={record?.buyer_username} />
      <Title level={5}>Item</Title>
      <TextField value={record?.item_title} />
      <Title level={5}>Total Price</Title>
      <NumberField value={record?.total_price ?? 0} options={{ style: "currency", currency: "USD" }} />
      <Title level={5}>Status</Title>
      <Tag>{record?.status}</Tag>
      <Title level={5}>Created At</Title>
      <DateField value={record?.created_at} />
    </Show>
  );
}
