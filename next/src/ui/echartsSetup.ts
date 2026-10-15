// The chart library, loaded after the first screen is drawn (see Chart.tsx).
import * as echarts from 'echarts/core';
import { BarChart, CustomChart, LineChart, ScatterChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, ScatterChart, CustomChart, GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, MarkAreaComponent, SVGRenderer]);
export { echarts };
