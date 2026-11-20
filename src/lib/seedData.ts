import type { Equipment, Room } from '../types/facility';

export const INITIAL_ROOMS: Omit<Room, 'updated_at'>[] = [
  { room_id: 'room-01', room_name: '회의실 1', floor: 7, capacity: 6, amenities: '대형 모니터 · 화이트보드', status: 'available' },
  { room_id: 'room-02', room_name: '회의실 2', floor: 7, capacity: 6, amenities: '대형 모니터 · 화이트보드', status: 'available' },
  { room_id: 'room-03', room_name: '회의실 3', floor: 7, capacity: 8, amenities: '화상회의 장비 · TV 모니터', status: 'available' },
  { room_id: 'room-04', room_name: '회의실 4', floor: 7, capacity: 8, amenities: '화상회의 장비 · TV 모니터', status: 'available' },
  { room_id: 'room-05', room_name: '회의실 5', floor: 7, capacity: 4, amenities: '소회의용 모니터', status: 'available' },
  { room_id: 'room-06', room_name: '회의실 6', floor: 7, capacity: 10, amenities: '프로젝터 · 화상회의 시스템', status: 'available' },
  { room_id: 'room-07', room_name: '회의실 7', floor: 7, capacity: 12, amenities: '대회의용 프로젝터 · 마이크', status: 'available' },
  { room_id: 'room-08', room_name: '회의실 8', floor: 10, capacity: 6, amenities: '대형 모니터 · 화이트보드', status: 'available' },
  { room_id: 'room-09', room_name: '회의실 9', floor: 10, capacity: 8, amenities: '화상회의 장비 · TV 모니터', status: 'available' },
  { room_id: 'room-10', room_name: '회의실 10', floor: 10, capacity: 10, amenities: '프로젝터 · 화상회의 시스템', status: 'available' },
  { room_id: 'room-11', room_name: '회의실 11', floor: 10, capacity: 14, amenities: '임원·전사 회의용 대형 스크린', status: 'available' },
];

export const INITIAL_EQUIPMENT: Omit<Equipment, 'updated_at'>[] = [
  { equipment_id: 'eq-laptop-01', type: 'laptop', management_number: '노트북-01', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
  { equipment_id: 'eq-laptop-02', type: 'laptop', management_number: '노트북-02', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
  { equipment_id: 'eq-laptop-03', type: 'laptop', management_number: '노트북-03', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
  { equipment_id: 'eq-laptop-04', type: 'laptop', management_number: '노트북-04', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
  { equipment_id: 'eq-laptop-05', type: 'laptop', management_number: '노트북-05', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
  { equipment_id: 'eq-tablet-01', type: 'tablet', management_number: '태블릿-01', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
  { equipment_id: 'eq-tablet-02', type: 'tablet', management_number: '태블릿-02', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
  { equipment_id: 'eq-tablet-03', type: 'tablet', management_number: '태블릿-03', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
  { equipment_id: 'eq-tablet-04', type: 'tablet', management_number: '태블릿-04', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
  { equipment_id: 'eq-tablet-05', type: 'tablet', management_number: '태블릿-05', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
  { equipment_id: 'eq-camera-01', type: 'camera', management_number: '카메라-01', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
  { equipment_id: 'eq-camera-02', type: 'camera', management_number: '카메라-02', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
  { equipment_id: 'eq-camera-03', type: 'camera', management_number: '카메라-03', storage_location: '7층 창고', status: 'available', current_loan_id: '', current_borrower_name: '', current_due_at: '' },
];
