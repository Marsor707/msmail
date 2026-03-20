import Alert from 'ant-design-vue/es/alert'
import App from 'ant-design-vue/es/app'
import Breadcrumb from 'ant-design-vue/es/breadcrumb'
import Button from 'ant-design-vue/es/button'
import Card from 'ant-design-vue/es/card'
import Col from 'ant-design-vue/es/col'
import ConfigProvider from 'ant-design-vue/es/config-provider'
import Descriptions from 'ant-design-vue/es/descriptions'
import Empty from 'ant-design-vue/es/empty'
import Form from 'ant-design-vue/es/form'
import Input from 'ant-design-vue/es/input'
import Layout from 'ant-design-vue/es/layout'
import List from 'ant-design-vue/es/list'
import Result from 'ant-design-vue/es/result'
import Row from 'ant-design-vue/es/row'
import Select from 'ant-design-vue/es/select'
import Skeleton from 'ant-design-vue/es/skeleton'
import Space from 'ant-design-vue/es/space'
import Statistic from 'ant-design-vue/es/statistic'
import Table from 'ant-design-vue/es/table'
import Tag from 'ant-design-vue/es/tag'
import Typography from 'ant-design-vue/es/typography'

const components = [
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  Col,
  ConfigProvider,
  Descriptions,
  Empty,
  Form,
  Input,
  Layout,
  List,
  Result,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
]

export default defineNuxtPlugin((nuxtApp) => {
  components.forEach((component) => {
    nuxtApp.vueApp.use(component)
  })
})
