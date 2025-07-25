import { Button, Collapse, Input, Select, Typography } from 'antd';
import { ColumnsType } from 'antd/es/table';
import logEvent from 'api/common/logEvent';
import { Temporality } from 'api/metricsExplorer/getMetricDetails';
import { MetricType } from 'api/metricsExplorer/getMetricsList';
import { UpdateMetricMetadataProps } from 'api/metricsExplorer/updateMetricMetadata';
import { ResizeTable } from 'components/ResizeTable';
import FieldRenderer from 'container/LogDetailedView/FieldRenderer';
import { DataType } from 'container/LogDetailedView/TableView';
import { useUpdateMetricMetadata } from 'hooks/metricsExplorer/useUpdateMetricMetadata';
import { useNotifications } from 'hooks/useNotifications';
import { Edit2, Save, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { MetricsExplorerEventKeys, MetricsExplorerEvents } from '../events';
import {
	METRIC_TYPE_LABEL_MAP,
	METRIC_TYPE_VALUES_MAP,
} from '../Summary/constants';
import { MetricTypeRenderer } from '../Summary/utils';
import { METRIC_METADATA_KEYS } from './constants';
import { MetadataProps } from './types';
import { determineIsMonotonic } from './utils';

function Metadata({
	metricName,
	metadata,
	refetchMetricDetails,
}: MetadataProps): JSX.Element {
	const [isEditing, setIsEditing] = useState(false);
	const [
		metricMetadata,
		setMetricMetadata,
	] = useState<UpdateMetricMetadataProps>({
		metricType: metadata?.metric_type || MetricType.SUM,
		description: metadata?.description || '',
		temporality: metadata?.temporality,
	});
	const { notifications } = useNotifications();
	const {
		mutate: updateMetricMetadata,
		isLoading: isUpdatingMetricsMetadata,
	} = useUpdateMetricMetadata();
	const [activeKey, setActiveKey] = useState<string | string[]>(
		'metric-metadata',
	);

	const tableData = useMemo(
		() =>
			metadata
				? Object.keys({
						...metadata,
						temporality: metadata?.temporality,
				  })
						// Filter out monotonic as user input is not required
						.filter((key) => key !== 'monotonic')
						.map((key) => ({
							key,
							value: {
								value: metadata[key as keyof typeof metadata],
								key,
							},
						}))
				: [],
		[metadata],
	);

	const columns: ColumnsType<DataType> = useMemo(
		() => [
			{
				title: 'Key',
				dataIndex: 'key',
				key: 'key',
				width: 50,
				align: 'left',
				className: 'metric-metadata-key',
				render: (field: string): JSX.Element => (
					<FieldRenderer
						field={
							METRIC_METADATA_KEYS[field as keyof typeof METRIC_METADATA_KEYS] || ''
						}
					/>
				),
			},
			{
				title: 'Value',
				dataIndex: 'value',
				key: 'value',
				width: 50,
				align: 'left',
				ellipsis: true,
				className: 'metric-metadata-value',
				render: (field: { value: string; key: string }): JSX.Element => {
					if (!isEditing || field.key === 'unit') {
						if (field.key === 'metric_type') {
							return (
								<div>
									<MetricTypeRenderer type={field.value as MetricType} />
								</div>
							);
						}
						return <FieldRenderer field={field.value || '-'} />;
					}
					if (field.key === 'metric_type') {
						return (
							<Select
								data-testid="metric-type-select"
								options={Object.entries(METRIC_TYPE_VALUES_MAP).map(([key]) => ({
									value: key,
									label: METRIC_TYPE_LABEL_MAP[key as MetricType],
								}))}
								defaultValue={metricMetadata.metricType}
								onChange={(value): void => {
									setMetricMetadata((prev) => ({
										...prev,
										metricType: value as MetricType,
									}));
								}}
							/>
						);
					}
					if (field.key === 'temporality') {
						return (
							<Select
								data-testid="temporality-select"
								options={Object.values(Temporality).map((key) => ({
									value: key,
									label: key,
								}))}
								defaultValue={metricMetadata.temporality}
								onChange={(value): void => {
									setMetricMetadata((prev) => ({
										...prev,
										temporality: value as Temporality,
									}));
								}}
							/>
						);
					}
					return (
						<Input
							data-testid="description-input"
							name={field.key}
							defaultValue={
								metricMetadata[
									field.key as Exclude<keyof UpdateMetricMetadataProps, 'isMonotonic'>
								]
							}
							onChange={(e): void => {
								setMetricMetadata((prev) => ({
									...prev,
									[field.key]: e.target.value,
								}));
							}}
						/>
					);
				},
			},
		],
		[isEditing, metricMetadata, setMetricMetadata],
	);

	const handleSave = useCallback(() => {
		updateMetricMetadata(
			{
				metricName,
				payload: {
					...metricMetadata,
					isMonotonic: determineIsMonotonic(
						metricMetadata.metricType,
						metricMetadata.temporality,
					),
				},
			},
			{
				onSuccess: (response): void => {
					if (response?.statusCode === 200) {
						logEvent(MetricsExplorerEvents.MetricMetadataUpdated, {
							[MetricsExplorerEventKeys.MetricName]: metricName,
							[MetricsExplorerEventKeys.Tab]: 'summary',
							[MetricsExplorerEventKeys.Modal]: 'metric-details',
						});
						notifications.success({
							message: 'Metadata updated successfully',
						});
						refetchMetricDetails();
						setIsEditing(false);
					} else {
						notifications.error({
							message:
								'Failed to update metadata, please try again. If the issue persists, please contact support.',
						});
					}
				},
				onError: (): void =>
					notifications.error({
						message:
							'Failed to update metadata, please try again. If the issue persists, please contact support.',
					}),
			},
		);
	}, [
		updateMetricMetadata,
		metricName,
		metricMetadata,
		notifications,
		refetchMetricDetails,
	]);

	const actionButton = useMemo(() => {
		if (isEditing) {
			return (
				<div className="action-menu">
					<Button
						className="action-button"
						type="text"
						onClick={(e): void => {
							e.stopPropagation();
							setIsEditing(false);
						}}
						disabled={isUpdatingMetricsMetadata}
					>
						<X size={14} />
						<Typography.Text>Cancel</Typography.Text>
					</Button>
					<Button
						className="action-button"
						type="text"
						onClick={(e): void => {
							e.stopPropagation();
							handleSave();
						}}
						disabled={isUpdatingMetricsMetadata}
					>
						<Save size={14} />
						<Typography.Text>Save</Typography.Text>
					</Button>
				</div>
			);
		}
		return (
			<div className="action-menu">
				<Button
					className="action-button"
					type="text"
					onClick={(e): void => {
						e.stopPropagation();
						setIsEditing(true);
					}}
					disabled={isUpdatingMetricsMetadata}
				>
					<Edit2 size={14} />
					<Typography.Text>Edit</Typography.Text>
				</Button>
			</div>
		);
	}, [handleSave, isEditing, isUpdatingMetricsMetadata]);

	const items = useMemo(
		() => [
			{
				label: (
					<div className="metrics-accordion-header metrics-metadata-header">
						<Typography.Text>Metadata</Typography.Text>
						{actionButton}
					</div>
				),
				key: 'metric-metadata',
				children: (
					<ResizeTable
						columns={columns}
						tableLayout="fixed"
						dataSource={tableData}
						pagination={false}
						showHeader={false}
						className="metrics-accordion-content metrics-metadata-container"
					/>
				),
			},
		],
		[actionButton, columns, tableData],
	);

	return (
		<Collapse
			bordered
			className="metrics-accordion metrics-metadata-accordion"
			activeKey={activeKey}
			onChange={(keys): void => setActiveKey(keys)}
			items={items}
		/>
	);
}

export default Metadata;
