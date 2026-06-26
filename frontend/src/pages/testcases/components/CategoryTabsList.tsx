import { FC } from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslation } from 'react-i18next'

interface Props {
  categories: string[]
}

const CategoryTabsList: FC<Props> = ({ categories }) => {
  const { t } = useTranslation()
  return (
    <TabsList className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
      <TabsTrigger
        value="all"
        className="border-input data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 border text-xs shadow-sm"
      >
        {t('testcases:categories.all')}
      </TabsTrigger>
      {categories.map((c) => (
        <TabsTrigger
          key={c}
          value={c}
          className="border-input data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 border text-xs shadow-sm"
        >
          {c}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}

export default CategoryTabsList
