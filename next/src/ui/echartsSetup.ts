// The chart library, loaded after the first screen is drawn (see Chart.tsx).
import * as echarts from 'echarts/core';
import { BarChart, CustomChart, LineChart, SankeyChart, ScatterChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, LegendScrollComponent, MarkAreaComponent, MarkLineComponent, MarkPointComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, SankeyChart, ScatterChart, CustomChart, GridComponent, LegendComponent, LegendScrollComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, MarkPointComponent, MarkAreaComponent, SVGRenderer]);
export { echarts };
