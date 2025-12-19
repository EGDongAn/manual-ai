'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Category {
  id: number;
  name: string;
  parent?: {
    id: number;
    name: string;
  } | null;
}

interface CategorySelectProps {
  value?: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CategorySelect({
  value,
  onChange,
  placeholder = '카테고리 선택',
  disabled = false,
}: CategorySelectProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch (error) {
        console.error('카테고리 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, []);

  const handleChange = (val: string) => {
    if (val === 'none') {
      onChange(null);
    } else {
      onChange(parseInt(val));
    }
  };

  return (
    <Select
      value={value?.toString() || 'none'}
      onValueChange={handleChange}
      disabled={disabled || loading}
    >
      <SelectTrigger>
        <SelectValue placeholder={loading ? '로딩 중...' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">미분류</SelectItem>
        {categories.map(category => (
          <SelectItem key={category.id} value={category.id.toString()}>
            {category.parent ? `${category.parent.name} > ` : ''}
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
